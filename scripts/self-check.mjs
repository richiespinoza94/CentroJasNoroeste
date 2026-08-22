// ponytail: one runnable check for the branchy domain logic (validation),
// not a full test suite. `npm run check` runs this.
import assert from 'node:assert/strict';
import { validateRegistration, validateManual, ageFromDate } from '../src/domain/validation.js';

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

console.log(`\n${passed} checks passed.`);
