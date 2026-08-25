import assert from 'node:assert/strict';
import fs from 'node:fs';

const form = fs.readFileSync('src/components/PublicForm/RegistrationForm.jsx', 'utf8');
const collections = fs.readFileSync('src/firebase/collections.js', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`ok — ${name}`);
}

check('1 rules use safe optional tableId access', () => assert.ok(rules.includes("d.get('tableId', null) == null")));
check('2 rules no longer use unsafe d.tableId == null', () => assert.ok(!rules.includes('d.tableId == null')));
check('3 public inscription keeps pending status requirement', () => assert.ok(rules.includes("d.status == 'pendiente'")));
check('4 public inscription keeps Miembro/Invitado restriction', () => assert.ok(rules.includes("d.categoria in ['Miembro', 'Invitado']")));
check('5 public inscription keeps WhatsApp format rule', () => assert.ok(rules.includes("d.whatsapp.matches('^9[0-9]{8}$')")));
check('6 inscription id remains activity+whatsapp scoped', () => assert.ok(rules.includes("inscripcionId == (d.activityId + '_' + d.whatsapp)")));
check('7 duplicate error code is exported', () => assert.ok(collections.includes("export const DUPLICATE_REGISTRATION_CODE = 'already-registered';")));
check('8 duplicate branch checks existing inscription', () => assert.ok(collections.includes('if (inscripcionSnap.exists())')));
check('9 duplicate branch assigns explicit code', () => assert.ok(collections.includes('err.code = DUPLICATE_REGISTRATION_CODE;')));
check('10 duplicate branch throws tagged error', () => assert.match(collections, /err\.code = DUPLICATE_REGISTRATION_CODE;[\s\S]{0,80}throw err;/));
check('11 registration remains transaction based', () => assert.ok(collections.includes('await runTransaction(db')));
check('12 transaction still reads persona and inscription together', () => assert.ok(collections.includes('Promise.all([tx.get(personaRef), tx.get(inscripcionRef)])')));
check('13 participant registration is awaited', () => assert.match(collections, /export async function registerParticipant[\s\S]*?await registerForActivity\(/));
check('14 public index mirror occurs after successful registration', () => {
  const block = collections.match(/export async function registerParticipant[\s\S]*?\n}/)?.[0] || '';
  assert.ok(block.indexOf('await registerForActivity(') < block.indexOf('mirrorPublicIndex('));
});
check('15 public index mirror is not called before registration', () => {
  const block = collections.match(/export async function registerParticipant[\s\S]*?\n}/)?.[0] || '';
  assert.ok(!/^.*mirrorPublicIndex[\s\S]*await registerForActivity/m.test(block));
});
check('16 activity id still participates in inscription document id', () => assert.ok(collections.includes('`${activityId}_${whatsapp}`')));
check('17 form imports duplicate error code', () => assert.ok(form.includes('DUPLICATE_REGISTRATION_CODE')));
check('18 form distinguishes duplicate code in catch', () => assert.ok(form.includes('if (err?.code === DUPLICATE_REGISTRATION_CODE)')));
check('19 duplicate message remains contextualized with activity name', () => assert.ok(form.includes('Ya estás registrado(a) para')));
check('20 generic failures no longer reuse duplicate message', () => assert.ok(form.includes('No pudimos completar tu registro en este momento.')));
check('21 generic failure is logged for diagnosis', () => assert.ok(form.includes("console.error('[registration] submit failed:', err)")));
check('22 generic failure does not focus WhatsApp branch', () => {
  const catchBody = form.match(/} catch \(err\) \{([\s\S]*?)\n\s*} finally \{/)?.[1] || '';
  const elseIndex = catchBody.lastIndexOf('} else {');
  assert.ok(elseIndex >= 0);
  const generic = catchBody.slice(elseIndex);
  assert.ok(generic.includes("console.error('[registration] submit failed:', err)"));
  assert.ok(generic.includes('setSubmitError('));
  assert.ok(!generic.includes("touch('whatsapp')"));
  assert.ok(!generic.includes('refs.current.whatsapp?.focus()'));
});
check('23 submitError state exists', () => assert.ok(form.includes('const [submitError, setSubmitError]')));
check('24 submitError is rendered as alert', () => assert.match(form, /submitError && \([\s\S]*?role="alert"/));
check('25 previous submit error is cleared before retry', () => assert.match(form, /setSubmitError\(''\);\s*setSubmitting\(true\)/));
check('26 editing form clears technical submit error', () => assert.ok(form.includes("if (submitError) setSubmitError('');")));
check('27 loader premium remains present', () => assert.ok(form.includes('ActivityLoadingCard')));
check('28 loading state still uses premium loader', () => assert.ok(form.includes('<ActivityLoadingCard message="Cargando actividad…" />')));
check('29 target activity is checked before form render', () => assert.ok(form.includes('if (!targetActivity)')));
check('30 successful submit still dispatches FORM_SUCCESS', () => assert.ok(form.includes("type: 'FORM_SUCCESS'")));

assert.equal(passed, 30);
console.log(`\n${passed} QA public registration checks passed.`);
