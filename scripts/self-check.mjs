// ponytail: one runnable check for the branchy domain logic (validation),
// not a full test suite. `npm run check` runs this.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateRegistration, validateManual, ageFromDate } from '../src/domain/validation.js';
import { getStatusMeta, STATUS_META } from '../src/domain/constants.js';
import { computeBarrioDist } from '../src/domain/stats.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`ok — ${name}`);
}

const validForm = {
  nombre: 'María',
  apellidos: 'Ramírez Torres',
  fechaNacimiento: '2000-01-01',
  sexo: 'F',
  categoria: 'Miembro',
  whatsapp: '955123456',
  estaca: 'Ventanilla',
  barrio: 'Naval',
  estacaOtra: '',
  correo: '',
  privacidad: true,
};

check('valid form has no errors', () => {
  assert.deepEqual(validateRegistration(validForm, []), {});
});

check('empty form fails required fields', () => {
  const errs = validateRegistration(
    { nombre: '', apellidos: '', fechaNacimiento: '', sexo: '', categoria: '', whatsapp: '', estaca: '', barrio: '', estacaOtra: '', correo: '', privacidad: false },
    []
  );
  for (const f of ['nombre', 'apellidos', 'fechaNacimiento', 'sexo', 'categoria', 'whatsapp', 'estaca', 'barrio', 'privacidad']) {
    assert.ok(errs[f], `expected error on ${f}`);
  }
});

check('categoria only accepts the public-safe values (Miembro/Invitado)', () => {
  assert.ok(validateRegistration({ ...validForm, categoria: 'Staff' }, []).categoria, 'a public submitter should not be able to self-declare as Staff');
  assert.ok(validateRegistration({ ...validForm, categoria: 'Líder' }, []).categoria, 'a public submitter should not be able to self-declare as Líder');
});

check('whatsapp must start with 9 and have 9 digits', () => {
  const errs = validateRegistration({ ...validForm, whatsapp: '855123456' }, []);
  assert.ok(errs.whatsapp);
});

check('duplicate whatsapp is rejected with the existing person named', () => {
  const dup = [{ whatsapp: '955123456', nombre: 'Ana', apellidos: 'Lopez' }];
  const errs = validateRegistration(validForm, dup);
  assert.match(errs.whatsapp, /Ana Lopez/);
});

check('age must be 18-35', () => {
  const tooYoung = validateRegistration({ ...validForm, fechaNacimiento: '2015-01-01' }, []);
  assert.ok(tooYoung.fechaNacimiento);
  const tooOld = validateRegistration({ ...validForm, fechaNacimiento: '1980-01-01' }, []);
  assert.ok(tooOld.fechaNacimiento);
});

check('"Otra estaca" requires a written stake name', () => {
  const errs = validateRegistration({ ...validForm, estaca: 'Otra estaca', estacaOtra: 'ab' }, []);
  assert.ok(errs.estacaOtra);
});

check('suspicious email local-part is rejected', () => {
  const errs = validateRegistration({ ...validForm, correo: 'test123@gmail.com' }, []);
  assert.ok(errs.correo);
});

check('ageFromDate returns null for garbage input', () => {
  assert.equal(ageFromDate('not-a-date'), null);
  assert.equal(ageFromDate(''), null);
});

check('validateManual requires whatsapp + estaca/barrio, no duplicates', () => {
  assert.ok(validateManual({ nombre: 'A', apellidos: 'B', whatsapp: '1', estaca: '', barrio: '' }, []));
  assert.equal(
    validateManual({ nombre: 'A', apellidos: 'B', whatsapp: '955123456', estaca: 'Ventanilla', barrio: 'Naval' }, []),
    null
  );
  assert.ok(
    validateManual({ nombre: 'A', apellidos: 'B', whatsapp: '955123456', estaca: 'Ventanilla', barrio: 'Naval' }, [{ whatsapp: '955123456' }])
  );
});

check('keyboard-mash names are rejected (noise pattern)', () => {
  assert.ok(validateRegistration({ ...validForm, nombre: 'asdfgh' }, []).nombre);
  assert.ok(validateRegistration({ ...validForm, nombre: 'Aaaaaa' }, []).nombre);
});

check('names with too few vowels for their length are rejected', () => {
  assert.ok(validateRegistration({ ...validForm, nombre: 'Bcdfgh' }, []).nombre);
});

check('names with alternating case are rejected', () => {
  assert.ok(validateRegistration({ ...validForm, apellidos: 'AbCdEfGhIj' }, []).apellidos);
});

check('a real hyphenated/accented name still passes', () => {
  const errs = validateRegistration({ ...validForm, nombre: 'José', apellidos: "D'Angelo Villar" }, []);
  assert.equal(errs.nombre, undefined);
  assert.equal(errs.apellidos, undefined);
});

check('whatsapp with an obviously fake digit pattern is rejected', () => {
  assert.ok(validateRegistration({ ...validForm, whatsapp: '999999999' }, []).whatsapp, 'all-same-digit should be rejected');
  assert.ok(validateRegistration({ ...validForm, whatsapp: '910101010' }, []).whatsapp, 'alternating 10 pattern should be rejected');
  assert.ok(validateRegistration({ ...validForm, whatsapp: '912121212' }, []).whatsapp, 'repeated 2-digit group should be rejected');
});

check('emails with repeated chars in the local part are rejected', () => {
  assert.ok(validateRegistration({ ...validForm, correo: 'aaaabbbb@gmail.com' }, []).correo);
});

check('a real-looking email still passes', () => {
  const errs = validateRegistration({ ...validForm, correo: 'maria.ramirez94@gmail.com' }, []);
  assert.equal(errs.correo, undefined);
});

// getStatusMeta — reemplaza los "qa-*.mjs" que llegaron con el último lote
// de parches: aquellos comprobaban que cierto texto existiera en el
// archivo fuente (frágil, se rompe con cualquier refactor sin que signifique
// un bug real, y no prueba comportamiento). Esto sí ejecuta la función real.
check('getStatusMeta returns the known metadata for a real status', () => {
  assert.deepEqual(getStatusMeta('presente'), STATUS_META.presente);
  assert.deepEqual(getStatusMeta('pendiente'), STATUS_META.pendiente);
});
check('getStatusMeta falls back gracefully for an unknown/legacy status', () => {
  // Cubre el caso real que rompía SearchTab/RecentActivity antes de esto:
  // un dato viejo con un status que ya no existe en el vocabulario actual
  // (ej. "asignado"/"sin_mesa", de cuando existían las mesas) no debe
  // tirar la pantalla — debe devolver algo mostrable.
  const meta = getStatusMeta('asignado');
  assert.ok(meta.label && meta.bg && meta.color);
  assert.ok(meta.label.includes('asignado'), 'el estado desconocido debería quedar visible en la etiqueta, no ocultarse');
});
check('getStatusMeta handles a missing/empty status without throwing', () => {
  assert.doesNotThrow(() => getStatusMeta(undefined));
  assert.doesNotThrow(() => getStatusMeta(''));
});

// Tripwire puntual (no una re-implementación de las reglas de Firestore):
// `d.tableId == null` con acceso directo a un campo que el código ya no
// escribe causaba un error de evaluación en las reglas → denegaba TODO
// registro público, disfrazado de "ya estás registrado". Ya se corrigió a
// `d.get('tableId', null) == null`. Esto solo evita que alguien reintroduzca
// el acceso directo sin querer — no reemplaza probar las reglas de verdad
// contra un emulador, que este proyecto no tiene configurado.
check('firestore.rules never accesses the removed tableId field directly (regression guard)', () => {
  const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.ok(!/\bd\.tableId\b/.test(rules), 'usa d.get(\'tableId\', null) en vez de d.tableId — el campo ya no se escribe, el acceso directo tira error de evaluación y deniega el permiso');
});

check('computeBarrioDist excludes participants from estacas outside the 3 known ones', () => {
  const rows = computeBarrioDist([
    { estaca: 'Puente Piedra', barrio: 'Las Lomas' },
    { estaca: 'Otro', barrio: 'Lomas' }, // texto libre parecido, pero NO es el mismo lugar
    { estaca: 'Villa El Salvador', barrio: 'Barrio Las Lomas' },
  ]);
  assert.equal(rows.length, 1, 'solo debería quedar el barrio de la persona de una estaca conocida');
  assert.equal(rows[0].label, 'Las Lomas');
  assert.equal(rows[0].count, 1);
});

console.log(`\n${passed} checks passed.`);
