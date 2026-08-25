import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const auth = read('src/firebase/auth.js');
const data = read('src/firebase/DataProvider.jsx');

let passed = 0;
function check(name, fn) { fn(); passed++; console.log('ok — ' + passed + ' ' + name); }

const catchStart = auth.indexOf("} catch (err) {\n      // A transient Firestore/network error");
const catchEnd = auth.indexOf('\n    }\n  });', catchStart);
const authCatch = catchStart >= 0 && catchEnd > catchStart ? auth.slice(catchStart, catchEnd) : '';
const missingStart = auth.indexOf('if (!snap.exists())');
const missingEnd = auth.indexOf('callback({ uid: user.uid', missingStart);
const missingBranch = missingStart >= 0 && missingEnd > missingStart ? auth.slice(missingStart, missingEnd) : '';

check('transient auth errors are caught', () => assert.ok(authCatch.includes("console.error('[auth] failed to restore staff session:'")));
check('transient auth errors finish loading via callback', () => assert.ok(authCatch.includes('callback(null)')));
check('transient auth errors do not sign out a valid Firebase session', () => assert.ok(!authCatch.includes('signOut(auth)')));
check('confirmed missing staff profile still signs out', () => assert.ok(missingBranch.includes('await signOut(auth)')));
check('DataProvider keeps independent error slots', () => ['activities: null','personas: null','inscripciones: null'].forEach((x) => assert.ok(data.includes(x))));
check('activities success clears only activities error', () => assert.ok(data.includes('({ ...prev, activities: null })')));
check('personas success clears only personas error', () => assert.ok(data.includes('({ ...prev, personas: null })')));
check('inscripciones success clears only inscripciones error', () => assert.ok(data.includes('({ ...prev, inscripciones: null })')));
check('activities failure writes activities slot', () => assert.ok(data.includes("activities: 'No pudimos cargar las actividades.")));
check('personas failure writes personas slot', () => assert.ok(data.includes("personas: 'No pudimos cargar las personas.")));
check('inscripciones failure writes inscripciones slot', () => assert.ok(data.includes("inscripciones: 'No pudimos cargar las inscripciones.")));
check('visible error is derived without erasing sibling errors', () => assert.ok(data.includes('dataErrors.activities || dataErrors.personas || dataErrors.inscripciones || null')));

console.log('\n' + passed + ' QA staff recovery checks passed.');
assert.equal(passed, 12);
