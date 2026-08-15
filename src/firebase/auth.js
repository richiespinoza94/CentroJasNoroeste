import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from './config.js';

// The 4-digit PIN UX stays exactly as designed; underneath, Firebase Auth
// (not Firestore) verifies it, so the PIN itself never touches the
// database. `username` becomes a synthetic email and `pin` gets padded past
// Firebase's 6-character password minimum — the padding is a length fix,
// not obfuscation; the real verification happens on Firebase's servers.
const EMAIL_DOMAIN = 'login.centrojasnoroeste.app';
const deriveEmail = (username) => `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
const derivePassword = (pin) => `cjn-${pin}-pin`;

const normalize = (username) => username.trim().toLowerCase();

/**
 * Where a username stands in the login flow, without needing to be signed
 * in: reserved by an admin but never claimed ('pending'), already has a
 * PIN ('claimed'), or doesn't exist at all (null).
 */
export async function getUsernameStatus(username) {
  const uname = normalize(username);
  const claimed = await getDoc(doc(db, 'usernames', uname));
  if (claimed.exists()) return { status: 'claimed', role: null };
  const pending = await getDoc(doc(db, 'pendingStaff', uname));
  if (pending.exists()) return { status: 'pending', role: pending.data().role };
  return { status: 'unknown', role: null };
}

/** First login: creates the Firebase Auth account + the real staff profile. */
export async function signUpStaff(username, pin) {
  const uname = normalize(username);
  const pending = await getDoc(doc(db, 'pendingStaff', uname));
  if (!pending.exists()) throw new Error('Este usuario ya no está disponible para crear cuenta.');
  const { role } = pending.data();

  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, deriveEmail(uname), derivePassword(pin));
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      throw new Error('Este usuario ya tiene una cuenta. Intenta ingresar con tu PIN en vez de crear uno nuevo.');
    }
    throw err;
  }
  const uid = cred.user.uid;

  // staff/{uid} + usernames/{uname} first, while pendingStaff/{uname} still
  // exists (its role is what the security rule checks this claim against).
  // Deleting the reservation is a separate step on purpose — see
  // firestore.rules for why the ordering matters.
  const batch = writeBatch(db);
  batch.set(doc(db, 'staff', uid), { username: uname, role, createdAt: Date.now() });
  batch.set(doc(db, 'usernames', uname), { uid });
  await batch.commit();
  await deleteDoc(doc(db, 'pendingStaff', uname));

  return { uid, username: uname, role };
}

export async function signInStaff(username, pin) {
  const uname = normalize(username);
  try {
    await signInWithEmailAndPassword(auth, deriveEmail(uname), derivePassword(pin));
  } catch (err) {
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
      throw new Error('PIN incorrecto.');
    }
    throw err;
  }
}

export function signOutStaff() {
  return signOut(auth);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fires with {uid, username, role} while signed in, or null while signed out. */
export function subscribeAuthState(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }
    // signUpStaff() writes the staff/{uid} profile in a batch *after*
    // creating the Firebase Auth account, so this listener can legitimately
    // fire in the split second before that write lands. A short retry
    // absorbs that window; if the doc is still missing after it, the
    // profile really was removed (an admin revoked access) and we sign out.
    let snap = await getDoc(doc(db, 'staff', user.uid));
    for (let attempt = 0; !snap.exists() && attempt < 5; attempt++) {
      await wait(300);
      snap = await getDoc(doc(db, 'staff', user.uid));
    }
    if (!snap.exists()) {
      await signOut(auth);
      callback(null);
      return;
    }
    callback({ uid: user.uid, ...snap.data() });
  });
}

/** Admin: reserve a username+role before that person has ever signed in. */
export async function addPendingStaff(username, role) {
  const uname = normalize(username);
  if (uname.length < 2) throw new Error('Nombre de usuario muy corto.');
  const [claimed, pending] = await Promise.all([getDoc(doc(db, 'usernames', uname)), getDoc(doc(db, 'pendingStaff', uname))]);
  if (claimed.exists() || pending.exists()) throw new Error('Ese usuario ya existe.');
  await setDoc(doc(db, 'pendingStaff', uname), { role, createdAt: Date.now() });
}

/** Admin: revoke access. Firestore-side only — see README for the Auth-account caveat. */
export async function removeStaffMember(entry) {
  const uname = normalize(entry.username);
  if (entry.claimed) {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'staff', entry.uid));
    batch.delete(doc(db, 'usernames', uname));
    await batch.commit();
  } else {
    await deleteDoc(doc(db, 'pendingStaff', uname));
  }
}

/** Admin-only: live merge of pending + claimed staff for the user management list. */
export function subscribeAllStaff(callback) {
  const state = { pending: [], claimed: [] };
  const emit = () => callback([...state.pending, ...state.claimed].sort((a, b) => a.username.localeCompare(b.username)));

  const unsubPending = onSnapshot(collection(db, 'pendingStaff'), (snap) => {
    state.pending = snap.docs.map((d) => ({ username: d.id, role: d.data().role, claimed: false, pin: null }));
    emit();
  });
  const unsubClaimed = onSnapshot(collection(db, 'staff'), (snap) => {
    state.claimed = snap.docs.map((d) => ({ uid: d.id, username: d.data().username, role: d.data().role, claimed: true, pin: 'set' }));
    emit();
  });

  return () => {
    unsubPending();
    unsubClaimed();
  };
}
