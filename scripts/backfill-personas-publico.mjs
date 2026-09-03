// Rellena `personas_publico` para cualquier persona que YA exista en
// `personas` pero nunca haya pasado por mirrorPublicIndex — es decir,
// cualquiera que entró al sistema por una migración masiva (Excel del
// Full Day, Fase 2 de La Velada, etc.) en vez del formulario/registro
// manual de la app. Esas migraciones escriben directo a Firestore con el
// SDK de administrador, sin pasar por collections.js, así que nunca
// dispararon el espejo — quedaban invisibles para el aviso "¿eres tú?"
// del formulario público, aunque ya estuvieran registrados de antes.
//
// Puramente aditivo: solo CREA lo que falta, nunca toca un documento de
// personas_publico que ya exista. Modo por defecto: solo reporta, no
// escribe nada — corre con --apply para crear lo que falta.
//
// Uso:
//   node --env-file=.env.local scripts/backfill-personas-publico.mjs            (reporte)
//   node --env-file=.env.local scripts/backfill-personas-publico.mjs --apply    (crea lo que falta)
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(APPLY ? 'Modo: APLICAR — se van a crear las entradas faltantes.\n' : 'Modo: SOLO REPORTE (nada se escribe). Corre con --apply para crear lo que falta.\n');

  const [personasSnap, publicoSnap] = await Promise.all([db.collection('personas').get(), db.collection('personas_publico').get()]);

  const yaEnIndice = new Set(publicoSnap.docs.map((d) => d.id));
  const faltantes = personasSnap.docs.filter((d) => !yaEnIndice.has(d.id));

  console.log(`${personasSnap.size} personas en total.`);
  console.log(`${yaEnIndice.size} ya estaban en el índice público.`);
  console.log(`${faltantes.length} les falta el espejo — el aviso "¿eres tú?" nunca las puede encontrar.\n`);

  if (faltantes.length === 0) {
    console.log('Nada que hacer — el índice ya está completo.');
    return;
  }

  console.log('Ejemplos (primeros 15):');
  faltantes.slice(0, 15).forEach((doc) => {
    const p = doc.data();
    console.log(`  ${p.nombre} ${p.apellidos} (${doc.id}) — ${p.estaca}`);
  });
  if (faltantes.length > 15) console.log(`  … y ${faltantes.length - 15} más.`);

  if (!APPLY) {
    console.log('\nCorre con --apply para crear las entradas faltantes.');
    return;
  }

  const batchSize = 400;
  let batch = db.batch();
  let opsInBatch = 0;
  let creados = 0;

  for (const doc of faltantes) {
    const p = doc.data();
    const nombreCompleto = `${(p.nombre || '').trim()} ${(p.apellidos || '').trim()}`.trim();
    if (!nombreCompleto) continue; // sin nombre no hay nada que indexar
    batch.set(db.collection('personas_publico').doc(doc.id), { nombreCompleto, estaca: p.estaca || '' });
    opsInBatch++;
    creados++;
    if (opsInBatch >= batchSize) {
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
  }
  if (opsInBatch > 0) await batch.commit();

  console.log(`\n${creados} entradas creadas en personas_publico.`);
}

await main();
