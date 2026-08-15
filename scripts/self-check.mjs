// ponytail: one runnable check for the branchy domain logic (validation +
// table recommendation), not a full test suite. `npm run check` runs this.
import assert from 'node:assert/strict';
import { validateRegistration, validateManual, ageFromDate } from '../src/domain/validation.js';
import { recommendTables } from '../src/domain/tables.js';

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
  tipoParticipante: 'Miembro',
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
    { nombre: '', apellidos: '', fechaNacimiento: '', sexo: '', tipoParticipante: '', whatsapp: '', estaca: '', barrio: '', estacaOtra: '', correo: '', privacidad: false },
    []
  );
  for (const f of ['nombre', 'apellidos', 'fechaNacimiento', 'sexo', 'tipoParticipante', 'whatsapp', 'estaca', 'barrio', 'privacidad']) {
    assert.ok(errs[f], `expected error on ${f}`);
  }
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

// occ is a denormalized counter Firestore keeps in sync inside the
// assign/unassign transaction (see src/firebase/collections.js) — these
// fixtures stand in for that field directly, no participants array needed.
const tables = [
  { id: 1, name: 'Mesa 1', capacity: 10, reservedFor: null, occ: 0 },
  { id: 2, name: 'Mesa 2', capacity: 10, reservedFor: null, occ: 0 },
  { id: 9, name: 'Mesa Programa', capacity: 8, reservedFor: 'programa', occ: 0 },
];

check('recommendTables excludes reserved tables for the wrong category', () => {
  const staffPerson = { categoria: 'staff' };
  const recs = recommendTables(staffPerson, tables);
  assert.ok(!recs.some((r) => r.id === 9), 'staff should not be recommended the programa table');
});

check('recommendTables includes the reserved table for its own category', () => {
  const programaPerson = { categoria: 'programa' };
  const recs = recommendTables(programaPerson, tables);
  assert.ok(recs.some((r) => r.id === 9));
});

check('recommendTables sorts tightest-fit first to avoid fragmentation', () => {
  const partial = [
    { id: 1, name: 'Mesa 1', capacity: 10, reservedFor: null, occ: 8 }, // 2 left
    { id: 2, name: 'Mesa 2', capacity: 10, reservedFor: null, occ: 0 }, // 10 left
  ];
  const recs = recommendTables({ categoria: 'participante' }, partial);
  assert.equal(recs[0].id, 1, 'tightest fit (2 left) should come before an empty table (10 left)');
});

check('recommendTables excludes full tables and caps at 3 results', () => {
  const manyTables = Array.from({ length: 5 }, (_, i) => ({ id: 100 + i, name: `T${i}`, capacity: 10, reservedFor: null, occ: 0 }));
  const recs = recommendTables({ categoria: 'participante' }, manyTables);
  assert.equal(recs.length, 3);
});

console.log(`\n${passed} checks passed.`);
