import {
  collection,
  doc,
  getDoc,
  getDocs,
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
function subscribeWithRetry(queryRef, onData, onError = () => {}) {
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
        onError(err);
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
export function subscribeActivities(callback, onError) {
  return subscribeWithRetry(query(collection(db, 'activities'), orderBy('createdAt', 'desc')), callback, onError);
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
// Fase 2 — identidad única en el formulario público. `personas_publico` es
// un índice de lectura pública con la exposición mínima decidida (nombre
// completo + estaca, nunca correo/fecha de nacimiento/barrio). Doc ID =
// whatsapp a propósito: es lo que permite que el formulario, al confirmar
// "¿eres tú?", enlace directo con esa persona en vez de crear una nueva —
// ver README/conversación de diseño para el trade-off aceptado.
// Lectura de un documento exacto (no un listado) — ya permitida por las
// reglas actuales (`allow get: if true` en personas, pensada justo para
// este tipo de chequeo de "¿ya existe este número?"). Se usa cuando alguien
// confirma "¿eres tú?": ya sabemos el whatsapp exacto (viene del ID del
// documento en personas_publico), así que podemos traer el resto de sus
// datos para autocompletar el formulario, sin necesitar un permiso nuevo.
export async function fetchPersonaByWhatsapp(whatsapp) {
  const snap = await getDoc(doc(db, 'personas', whatsapp));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function subscribePublicIndex() {
  return getDocs(collection(db, 'personas_publico')).then((snap) => snap.docs.map((d) => ({ whatsapp: d.id, ...d.data() })));
}

function mirrorPublicIndex(whatsapp, nombreCompleto, estaca) {
  setDoc(doc(db, 'personas_publico', whatsapp), { nombreCompleto, estaca }).catch(() => {});
}

export const DUPLICATE_REGISTRATION_CODE = 'already-registered';

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
// Historial de actividades (Admin): trae TODAS las inscripciones de una
// sola vez (sin filtrar por actividad) para poder agrupar por actividad en
// el cliente. Es una lectura puntual (no un listener en vivo) — el
// historial no necesita actualizarse en tiempo real como sí lo necesita la
// recepción de la actividad activa.
export function fetchAllInscripciones() {
  return getDocs(collection(db, 'inscripciones')).then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}

export function subscribePersonas(callback, onError) {
  return subscribeWithRetry(collection(db, 'personas'), (rows) => callback(rows.map((r) => ({ ...r, whatsapp: r.id }))), onError);
}

// Staff-only, inscripciones for one activity at a time — this is what
// Reception/Admin actually operate on day-to-day.
export function subscribeInscripciones(activityId, callback, onError) {
  return subscribeWithRetry(query(collection(db, 'inscripciones'), where('activityId', '==', activityId)), callback, onError);
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
      const err = new Error('Ya existe un registro con este número para esta actividad.');
      err.code = DUPLICATE_REGISTRATION_CODE;
      throw err;
    }
    tx.set(
      personaRef,
      { ...personaData, ...(personaSnap.exists() ? {} : { createdAt: serverTimestamp() }), updatedAt: serverTimestamp() },
      { merge: true }
    );
    tx.set(inscripcionRef, { ...inscripcionData, activityId, whatsapp, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
}

export async function registerParticipant(form, activityId) {
  const estaca = form.estaca === 'Otra estaca' ? form.estacaOtra.trim() : form.estaca;
  await registerForActivity(
    activityId,
    form.whatsapp,
    {
      nombre: form.nombre.trim(),
      apellidos: form.apellidos.trim(),
      sexo: form.sexo,
      fechaNacimiento: form.fechaNacimiento,
      estaca,
      barrio: form.barrio.trim(),
      correo: form.correo,
    },
    { categoria: form.categoria, status: 'pendiente' }
  );
  mirrorPublicIndex(form.whatsapp, `${form.nombre.trim()} ${form.apellidos.trim()}`, estaca);
}

export function registerManual(m, activityId) {
  mirrorPublicIndex(m.whatsapp, `${m.nombre.trim()} ${m.apellidos.trim()}`, m.estaca);
  return registerForActivity(
    activityId,
    m.whatsapp,
    { nombre: m.nombre.trim(), apellidos: m.apellidos.trim(), estaca: m.estaca, barrio: m.barrio.trim() },
    { categoria: m.categoria, status: 'presente' }
  );
}

export function updatePersona(whatsapp, data) {
  mirrorPublicIndex(whatsapp, `${data.nombre.trim()} ${data.apellidos.trim()}`, data.estaca);
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

/** Undo an accidental check-in — back to "pendiente". */
export function revertCheckIn(inscripcionId) {
  return updateDoc(doc(db, 'inscripciones', inscripcionId), { status: 'pendiente', updatedAt: serverTimestamp() });
}

/**
 * Corrige la categoría de alguien ya registrado en esta actividad (p.ej. se
 * registró como Miembro y terminó sumándose al staff del evento).
 */
export function setCategoria(inscripcionId, categoria) {
  return updateDoc(doc(db, 'inscripciones', inscripcionId), { categoria, updatedAt: serverTimestamp() });
}
