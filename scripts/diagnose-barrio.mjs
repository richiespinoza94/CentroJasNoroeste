// Diagnóstico puntual — no corrige nada, solo muestra por qué algunas
// personas con "lomas" en el barrio no se fusionaron con "Las Lomas" pese
// a haber corrido standardize-estaca-barrio.mjs --apply. Reusable para
// cualquier otro patrón sospechoso más adelante (cambiar el patrón por
// argumento).
//
// Uso: node --env-file=.env.local scripts/diagnose-barrio.mjs [patron]
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const PATRON = new RegExp(process.argv[2] || 'loma', 'i');

async function main() {
  const snap = await db.collection('personas').get();
  const sospechosos = snap.docs.filter((d) => PATRON.test(d.data().barrio || ''));

  console.log(`${snap.size} personas revisadas. ${sospechosos.length} con barrio que calza /${PATRON.source}/i:\n`);
  for (const doc of sospechosos) {
    const p = doc.data();
    console.log(`${p.nombre} ${p.apellidos} (${doc.id})`);
    console.log(`  estaca: "${p.estaca}"`);
    console.log(`  barrio: "${p.barrio}"`);
    console.log(`  updatedAt: ${p.updatedAt?.toDate?.() || p.updatedAt}`);
    console.log();
  }
}

await main();
