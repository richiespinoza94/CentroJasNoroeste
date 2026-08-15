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

export function subscribeParticipants(callback) {
  return subscribeWithRetry(query(collection(db, 'participants'), orderBy('createdAt', 'asc')), callback);
}

export function subscribeTables(callback) {
  return subscribeWithRetry(query(collection(db, 'tables'), orderBy('createdAt', 'asc')), callback);
}

async function createParticipant(whatsapp, data) {
  const ref = doc(db, 'participants', whatsapp);
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists()) {
      const p = existing.data();
      throw new Error(`Ya existe un registro con este número (${p.nombre} ${p.apellidos}).`);
    }
    tx.set(ref, { ...data, whatsapp, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
}

export function registerParticipant(form) {
  return createParticipant(form.whatsapp, {
    nombre: form.nombre.trim(),
    apellidos: form.apellidos.trim(),
    sexo: form.sexo,
    estaca: form.estaca === 'Otra estaca' ? form.estacaOtra.trim() : form.estaca,
    barrio: form.barrio.trim(),
    correo: form.correo,
    categoria: form.categoria,
    status: 'pendiente',
    tableId: null,
  });
}

export function registerManual(m) {
  return createParticipant(m.whatsapp, {
    nombre: m.nombre.trim(),
    apellidos: m.apellidos.trim(),
    sexo: '',
    estaca: m.estaca,
    barrio: m.barrio.trim(),
    correo: '',
    categoria: m.categoria,
    status: 'presente',
    tableId: null,
  });
}

export function checkIn(whatsapp) {
  return updateDoc(doc(db, 'participants', whatsapp), { status: 'presente', updatedAt: serverTimestamp() });
}

/** Undo an accidental check-in — back to "pendiente", only valid before a table was assigned. */
export function revertCheckIn(whatsapp) {
  return updateDoc(doc(db, 'participants', whatsapp), { status: 'pendiente', updatedAt: serverTimestamp() });
}

/**
 * Staff doesn't necessarily sit at a table — this closes that loop instead
 * of leaving them stuck in "presente" showing an unresolved "mesas
 * recomendadas" prompt every time someone looks them up.
 */
export function markNoTableNeeded(whatsapp) {
  return updateDoc(doc(db, 'participants', whatsapp), { status: 'sin_mesa', tableId: null, updatedAt: serverTimestamp() });
}

/** Undo "sin mesa" — back to "presente", in case it was marked by mistake or plans changed. */
export function revertNoTableNeeded(whatsapp) {
  return updateDoc(doc(db, 'participants', whatsapp), { status: 'presente', updatedAt: serverTimestamp() });
}

/**
 * Corrige la categoría de alguien ya registrado (p.ej. se registró como
 * Miembro y terminó sumándose al staff del evento). También sirve para
 * migrar a mano un registro que quedó con el esquema viejo (categoria:
 * 'participante'/'programa'/'staff') — ver nota del README.
 */
export function setCategoria(whatsapp, categoria) {
  return updateDoc(doc(db, 'participants', whatsapp), { categoria, updatedAt: serverTimestamp() });
}

/**
 * Moves a participant onto a table, capacity-checked and race-safe: this is
 * the one operation the PRD calls out explicitly (§16) — two reception
 * devices assigning the last two seats at the same instant must never both
 * succeed. `table.occ` is a denormalized counter kept in sync with
 * participant.tableId inside this same transaction, so a capacity check is
 * a single-document read instead of a collection scan.
 */
export async function assignTable(whatsapp, tableId) {
  const participantRef = doc(db, 'participants', whatsapp);
  const tableRef = doc(db, 'tables', tableId);

  await runTransaction(db, async (tx) => {
    const [participantSnap, tableSnap] = await Promise.all([tx.get(participantRef), tx.get(tableRef)]);
    if (!tableSnap.exists()) throw new Error('Esa mesa ya no existe.');
    const table = tableSnap.data();
    const participant = participantSnap.data();

    let previousTableSnap = null;
    if (participant.tableId && participant.tableId !== tableId) {
      previousTableSnap = await tx.get(doc(db, 'tables', participant.tableId));
    }

    const occ = table.occ || 0;
    if (occ >= table.capacity) throw new Error(`${table.name} ya está completa.`);

    if (previousTableSnap?.exists()) {
      tx.update(previousTableSnap.ref, { occ: Math.max(0, (previousTableSnap.data().occ || 0) - 1) });
    }
    tx.update(tableRef, { occ: occ + 1 });
    tx.update(participantRef, { status: 'asignado', tableId, updatedAt: serverTimestamp() });
  });
}

export async function unassignTable(whatsapp) {
  const participantRef = doc(db, 'participants', whatsapp);
  await runTransaction(db, async (tx) => {
    const participantSnap = await tx.get(participantRef);
    const participant = participantSnap.data();
    if (participant.tableId) {
      const tableRef = doc(db, 'tables', participant.tableId);
      const tableSnap = await tx.get(tableRef);
      if (tableSnap.exists()) tx.update(tableRef, { occ: Math.max(0, (tableSnap.data().occ || 0) - 1) });
    }
    tx.update(participantRef, { status: 'presente', tableId: null, updatedAt: serverTimestamp() });
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
