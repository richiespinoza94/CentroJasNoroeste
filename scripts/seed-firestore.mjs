// One-time setup script. Run with:
//   node --env-file=.env.local scripts/seed-firestore.mjs
// Needs GOOGLE_APPLICATION_CREDENTIALS pointing at a service account key
// (Firebase console → Project settings → Service accounts → Generate new
// private key). Uses the Admin SDK, which bypasses firestore.rules — this
// is the one place in the whole app that's allowed to.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { DEFAULT_TABLES } from '../src/domain/constants.js';

// Keep these two in sync with src/firebase/auth.js — duplicated on purpose,
// the Admin SDK and the client SDK can't share a module cleanly, and it's
// two one-line functions, not worth a shared package for.
const EMAIL_DOMAIN = 'login.centrojasnoroeste.app';
const deriveEmail = (username) => `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
const derivePassword = (pin) => `cjn-${pin}-pin`;

initializeApp({ credential: applicationDefault() });
const db = getFirestore();
const auth = getAuth();

async function seedTables() {
  let created = 0;
  for (const t of DEFAULT_TABLES) {
    const ref = db.collection('tables').doc(String(t.id));
    const snap = await ref.get();
    if (snap.exists) continue; // never clobber an admin's edits on re-run
    await ref.set({ name: t.name, capacity: t.capacity, reservedFor: t.reservedFor, occ: 0, createdAt: FieldValue.serverTimestamp() });
    created++;
  }
  console.log(`tables: ${created} created, ${DEFAULT_TABLES.length - created} already existed.`);
}

async function seedBootstrapAdmin() {
  const username = (process.env.SEED_ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const pin = process.env.SEED_ADMIN_PIN || '1234';
  const email = deriveEmail(username);

  let user;
  try {
    user = await auth.getUserByEmail(email);
    console.log(`admin bootstrap: "${username}" already has an account (${user.uid}), leaving it as-is.`);
    return;
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
  }

  user = await auth.createUser({ email, password: derivePassword(pin) });
  await db.collection('staff').doc(user.uid).set({ username, role: 'admin', createdAt: FieldValue.serverTimestamp() });
  await db.collection('usernames').doc(username).set({ uid: user.uid });
  console.log(`admin bootstrap: created "${username}" (PIN ${pin}) — change this PIN after first login.`);
}

await seedTables();
await seedBootstrapAdmin();
console.log('\nDone.');
