import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './config.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A listener opened in the instant right after sign-up can race Firestore's
 * own propagation of the just-written staff/{uid} profile the security
 * rules depend on — the same document a plain get() already sees can still
 * read as "doesn't exist yet" to a brand-new streaming listener's rule
 * evaluation. That's a narrow, genuine consistency window (not just an
 * emulator quirk), so a denied listener here gets a few short retries
 * before it's treated as a real, permanent permission problem.
 */
function subscribeWithRetry(queryRef, onData) {
  let cancelled = false;
  let liveUnsub = () => {};

  function attempt(n) {
    liveUnsub = onSnapshot(
      queryRef,
      (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        if (cancelled) return;
        if (err.code === 'permission-denied' && n < 5) {
          wait(400 * (n + 1)).then(() => {
            if (!cancelled) attempt(n + 1);
          });
          return;
        }
        console.error('[firestore] subscription failed:', err);
      }
    );
  }
  attempt(0);

  return () => {
    cancelled = true;
    liveUnsub();
  };
}

// Activities — publicly readable (see firestore.rules), so this subscribes
// regardless of auth state, unlike participants/tables below.
export function subscribeActivities(callback) {
  return subscribeWithRetry(query(collection(db, 'activities'), orderBy('createdAt', 'desc')), callback);
}

export async function createActivity(data) {
  const ref = doc(collection(db, 'activities'));
  await setDoc(ref, {
    nombre: data.nombre.trim(),
    fecha: data.fecha.trim(),
    lugar: data.lugar.trim(),
    anfitrion: data.anfitrion.trim(),
    activa: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function updateActivity(activityId, data) {
  return updateDoc(doc(db, 'activities', activityId), {
    nombre: data.nombre.trim(),
    fecha: data.fecha.trim(),
    lugar: data.lugar.trim(),
    anfitrion: data.anfitrion.trim(),
  });
}

/**
 * Exactly one activity is "activa" at a time — that's the one the public
 * form and the reception/admin headers show. Activating a new one
 * deactivates whichever was active before, inside the same transaction so
 * there's never a moment (or a race between two admins) with zero or two
 * active activities.
 */
export async function setActiveActivity(activityId, allActivities) {
  await runTransaction(db, async (tx) => {
    const currentActive = allActivities.find((a) => a.activa && a.id !== activityId);
    if (currentActive) tx.update(doc(db, 'activities', currentActive.id), { activa: false });
    tx.update(doc(db, 'activities', activityId), { activa: true });
  });
}

// Fase 2 — identidad única. `personas` is the global identity directory (one
// doc per WhatsApp, shared across every activity); `inscripciones` is the
// per-activity participation record. Reception/Admin still work with a
// single joined "participant" shape — see DataProvider.jsx — so this is the
// only file that needs to know the data lives in two collections now.
const inscripcionDocId = (activityId, whatsapp) => `${activityId}_${whatsapp}`;

// Staff-only, all personas (used by Admin → Personas and by the join in
// DataProvider). No orderBy on purpose — a composite index would be needed
// to combine it with the inscripciones query's own filtering, and the
// dataset is small enough that sorting client-side is simpler.
//
// `whatsapp` isn't stored as a field inside the doc (the doc ID already is
// the number) — this is the one place that derives it back onto every row,
// so nothing downstream needs to know id===whatsapp is an implementation
// detail.
export function subscribePersonas(callback) {
  return subscribeWithRetry(collection(db, 'personas'), (rows) => callback(rows.map((r) => ({ ...r, whatsapp: r.id }))));
}

// Staff-only, inscripciones for one activity at a time — this is what
// Reception/Admin actually operate on day-to-day.
export function subscribeInscripciones(activityId, callback) {
  return subscribeWithRetry(query(collection(db, 'inscripciones'), where('activityId', '==', activityId)), callback);
}

export function subscribeTables(callback) {
  return subscribeWithRetry(query(collection(db, 'tables'), orderBy('createdAt', 'asc')), callback);
}

/**
 * Upserts identity data into `personas/{whatsapp}` (merge — a returning
 * person's latest details win, but this never fails if they already exist)
 * and creates `inscripciones/{activityId}_{whatsapp}` (fails atomically if
 * that exact activity+phone combo is already registered — the same "no
 * duplicate registration" trick the old participants collection used, now
 * scoped per activity instead of globally).
 */
async function registerForActivity(activityId, whatsapp, personaData, inscripcionData) {
  const personaRef = doc(db, 'personas', whatsapp);
  const inscripcionRef = doc(db, 'inscripciones', inscripcionDocId(activityId, whatsapp));

  await runTransaction(db, async (tx) => {
    const [personaSnap, inscripcionSnap] = await Promise.all([tx.get(personaRef), tx.get(inscripcionRef)]);
    if (inscripcionSnap.exists()) {
      throw new Error('Ya existe un registro con este número para esta actividad.');
    }
    tx.set(
      personaRef,
      { ...personaData, ...(personaSnap.exists() ? {} : { createdAt: serverTimestamp() }), updatedAt: serverTimestamp() },
      { merge: true }
    );
    tx.set(inscripcionRef, { ...inscripcionData, activityId, whatsapp, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
}

export function registerParticipant(form, activityId) {
  return registerForActivity(
    activityId,
    form.whatsapp,
    {
      nombre: form.nombre.trim(),
      apellidos: form.apellidos.trim(),
      sexo: form.sexo,
      fechaNacimiento: form.fechaNacimiento,
      estaca: form.estaca === 'Otra estaca' ? form.estacaOtra.trim() : form.estaca,
      barrio: form.barrio.trim(),
      correo: form.correo,
    },
    { categoria: form.categoria, status: 'pendiente', tableId: null }
  );
}

export function registerManual(m, activityId) {
  return registerForActivity(
    activityId,
    m.whatsapp,
    { nombre: m.nombre.trim(), apellidos: m.apellidos.trim(), estaca: m.estaca, barrio: m.barrio.trim() },
    { categoria: m.categoria, status: 'presente', tableId: null }
  );
}

export function updatePersona(whatsapp, data) {
  return updateDoc(doc(db, 'personas', whatsapp), {
    nombre: data.nombre.trim(),
    apellidos: data.apellidos.trim(),
    sexo: data.sexo,
    fechaNacimiento: data.fechaNacimiento,
    estaca: data.estaca,
    barrio: data.barrio.trim(),
    correo: data.correo.trim(),
    updatedAt: serverTimestamp(),
  });
}

export function checkIn(inscripcionId) {
  return updateDoc(doc(db, 'inscripciones', inscripcionId), { status: 'presente', updatedAt: serverTimestamp() });
}

/** Undo an accidental check-in — back to "pendiente", only valid before a table was assigned. */
export function revertCheckIn(inscripcionId) {
  return updateDoc(doc(db, 'inscripciones', inscripcionId), { status: 'pendiente', updatedAt: serverTimestamp() });
}

/**
 * Staff doesn't necessarily sit at a table — this closes that loop instead
 * of leaving them stuck in "presente" showing an unresolved "mesas
 * recomendadas" prompt every time someone looks them up.
 */
export function markNoTableNeeded(inscripcionId) {
  return updateDoc(doc(db, 'inscripciones', inscripcionId), { status: 'sin_mesa', tableId: null, updatedAt: serverTimestamp() });
}

/** Undo "sin mesa" — back to "presente", in case it was marked by mistake or plans changed. */
export function revertNoTableNeeded(inscripcionId) {
  return updateDoc(doc(db, 'inscripciones', inscripcionId), { status: 'presente', updatedAt: serverTimestamp() });
}

/**
 * Corrige la categoría de alguien ya registrado en esta actividad (p.ej. se
 * registró como Miembro y terminó sumándose al staff del evento).
 */
export function setCategoria(inscripcionId, categoria) {
  return updateDoc(doc(db, 'inscripciones', inscripcionId), { categoria, updatedAt: serverTimestamp() });
}

/**
 * Moves a participant onto a table, capacity-checked and race-safe: this is
 * the one operation the PRD calls out explicitly (§16) — two reception
 * devices assigning the last two seats at the same instant must never both
 * succeed. `table.occ` is a denormalized counter kept in sync with the
 * inscripción's tableId inside this same transaction, so a capacity check
 * is a single-document read instead of a collection scan.
 */
export async function assignTable(inscripcionId, tableId) {
  const inscripcionRef = doc(db, 'inscripciones', inscripcionId);
  const tableRef = doc(db, 'tables', tableId);

  await runTransaction(db, async (tx) => {
    const [inscripcionSnap, tableSnap] = await Promise.all([tx.get(inscripcionRef), tx.get(tableRef)]);
    if (!tableSnap.exists()) throw new Error('Esa mesa ya no existe.');
    const table = tableSnap.data();
    const inscripcion = inscripcionSnap.data();

    let previousTableSnap = null;
    if (inscripcion.tableId && inscripcion.tableId !== tableId) {
      previousTableSnap = await tx.get(doc(db, 'tables', inscripcion.tableId));
    }

    const occ = table.occ || 0;
    if (occ >= table.capacity) throw new Error(`${table.name} ya está completa.`);

    if (previousTableSnap?.exists()) {
      tx.update(previousTableSnap.ref, { occ: Math.max(0, (previousTableSnap.data().occ || 0) - 1) });
    }
    tx.update(tableRef, { occ: occ + 1 });
    tx.update(inscripcionRef, { status: 'asignado', tableId, updatedAt: serverTimestamp() });
  });
}

export async function unassignTable(inscripcionId) {
  const inscripcionRef = doc(db, 'inscripciones', inscripcionId);
  await runTransaction(db, async (tx) => {
    const inscripcionSnap = await tx.get(inscripcionRef);
    const inscripcion = inscripcionSnap.data();
    if (inscripcion.tableId) {
      const tableRef = doc(db, 'tables', inscripcion.tableId);
      const tableSnap = await tx.get(tableRef);
      if (tableSnap.exists()) tx.update(tableRef, { occ: Math.max(0, (tableSnap.data().occ || 0) - 1) });
    }
    tx.update(inscripcionRef, { status: 'presente', tableId: null, updatedAt: serverTimestamp() });
  });
}

export async function addTable(existingTables) {
  const n = existingTables.length + 1;
  const ref = doc(collection(db, 'tables'));
  await setDoc(ref, { name: `Mesa ${n}`, capacity: 10, reservedFor: null, occ: 0, createdAt: serverTimestamp() });
  return ref.id;
}

export async function removeTable(tableId) {
  const ref = doc(db, 'tables', tableId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    if ((snap.data().occ || 0) > 0) throw new Error('Esta mesa todavía tiene personas asignadas.');
    tx.delete(ref);
  });
}

export function setTableCapacity(tableId, capacity) {
  return updateDoc(doc(db, 'tables', tableId), { capacity: Math.max(1, parseInt(capacity, 10) || 1) });
}

export function setTableReserved(tableId, reservedFor) {
  return updateDoc(doc(db, 'tables', tableId), { reservedFor: reservedFor || null });
}
