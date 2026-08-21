// One-time migration. Run with:
//   node --env-file=.env.local scripts/migrate-personas-fase2.mjs <activityId>
// Needs GOOGLE_APPLICATION_CREDENTIALS pointing at a service account key
// (same setup as seed-firestore.mjs). Uses the Admin SDK, which bypasses
// firestore.rules.
//
// Splits every doc in the old flat `participants` collection into:
//   - personas/{whatsapp}        — identity data, shared across activities
//   - inscripciones/{activityId}_{whatsapp} — this person's registration
//     for the one activity all of today's `participants` data actually
//     belongs to (see README/memory notes: it's "La Velada").
//
// Non-destructive and safe to re-run: never deletes `participants`, and
// re-running just overwrites the same personas/inscripciones docs with the
// same data.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const activityId = process.argv[2];

async function listActivities() {
  const snap = await db.collection('activities').get();
  console.log('\nActividades disponibles (usa el ID exacto, no el nombre):');
  snap.forEach((d) => console.log(`  ${d.id}  —  ${d.data().nombre} (${d.data().fecha})`));
}

async function migrate() {
  if (!activityId) {
    console.error('Falta el activityId. Uso: node --env-file=.env.local scripts/migrate-personas-fase2.mjs <activityId>');
    await listActivities();
    process.exit(1);
  }

  const activitySnap = await db.collection('activities').doc(activityId).get();
  if (!activitySnap.exists) {
    console.error(`No existe una actividad con ID "${activityId}".`);
    await listActivities();
    process.exit(1);
  }
  console.log(`Migrando hacia la actividad: "${activitySnap.data().nombre}" (${activitySnap.data().fecha})`);

  const participantsSnap = await db.collection('participants').get();
  console.log(`${participantsSnap.size} registros encontrados en participants.\n`);

  let migrated = 0;
  const batchSize = 400; // Firestore batch limit is 500 writes; stay comfortably under it (2 writes per person)
  let batch = db.batch();
  let opsInBatch = 0;

  for (const doc of participantsSnap.docs) {
    const whatsapp = doc.id;
    const p = doc.data();

    const personaRef = db.collection('personas').doc(whatsapp);
    batch.set(
      personaRef,
      {
        nombre: p.nombre || '',
        apellidos: p.apellidos || '',
        sexo: p.sexo || '',
        estaca: p.estaca || '',
        barrio: p.barrio || '',
        correo: p.correo || '',
        createdAt: p.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const inscripcionRef = db.collection('inscripciones').doc(`${activityId}_${whatsapp}`);
    batch.set(inscripcionRef, {
      activityId,
      whatsapp,
      categoria: p.categoria || 'Miembro',
      status: p.status || 'pendiente',
      tableId: p.tableId ?? null,
      createdAt: p.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    migrated++;
    opsInBatch += 2;
    if (opsInBatch >= batchSize) {
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
  }
  if (opsInBatch > 0) await batch.commit();

  console.log(`\nListo — ${migrated} personas + ${migrated} inscripciones creadas/actualizadas.`);
  console.log('El original en `participants` NO se borró — se dejó como respaldo (ver firestore.rules).');
}

await migrate();
