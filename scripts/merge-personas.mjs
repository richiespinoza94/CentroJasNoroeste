// Fusiona dos registros que son la MISMA persona con números distintos —
// típicamente alguien que se registró una vez con un número falso o mal
// escrito y otra vez con el real.
//
// Complemento de change-whatsapp.mjs: aquel mueve una persona a un número
// libre; este resuelve el caso en que AMBOS números ya existen.
//
// Reglas de fusión (explícitas a propósito, para que no haya sorpresas):
//   - El número que se CONSERVA es el segundo argumento (el bueno).
//   - Para cada campo de identidad, gana el valor del que se conserva; si
//     ese campo está vacío, se completa con el del duplicado. Nunca se
//     pisa un dato bueno con uno vacío.
//   - Las inscripciones del duplicado se mueven al número que se conserva.
//     Si AMBOS fueron a la misma actividad, se conserva la del número
//     bueno y se descarta la duplicada (avisando cuál) — no se puede tener
//     dos inscripciones de la misma persona en la misma actividad.
//   - El registro duplicado se elimina al final (persona + índice público).
//
// Modo por defecto: SOLO REPORTE. Corre con --apply para ejecutarlo.
//
// Uso:
//   node --env-file=.env.local scripts/merge-personas.mjs <numero-duplicado> <numero-a-conservar>
//   node --env-file=.env.local scripts/merge-personas.mjs 999999991 922780896 --apply
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const [, , duplicado, conservar] = process.argv;
const APPLY = process.argv.includes('--apply');

const CAMPOS = ['nombre', 'apellidos', 'sexo', 'fechaNacimiento', 'estaca', 'barrio', 'correo'];

async function main() {
  if (!duplicado || !conservar || duplicado.startsWith('--') || conservar.startsWith('--')) {
    console.error('Uso: node --env-file=.env.local scripts/merge-personas.mjs <numero-duplicado> <numero-a-conservar> [--apply]');
    process.exit(1);
  }
  if (duplicado === conservar) {
    console.error('Son el mismo número — nada que fusionar.');
    process.exit(1);
  }

  console.log(APPLY ? 'Modo: APLICAR la fusión.\n' : 'Modo: SOLO REPORTE (nada se escribe). Agrega --apply para ejecutarlo.\n');

  const [dupSnap, keepSnap] = await Promise.all([db.collection('personas').doc(duplicado).get(), db.collection('personas').doc(conservar).get()]);

  if (!dupSnap.exists) {
    console.error(`No existe ninguna persona con el número "${duplicado}".`);
    process.exit(1);
  }
  if (!keepSnap.exists) {
    console.error(`No existe ninguna persona con el número "${conservar}". Si ese número está libre, usa change-whatsapp.mjs en vez de este script.`);
    process.exit(1);
  }

  const dup = dupSnap.data();
  const keep = keepSnap.data();

  console.log('SE ELIMINA (duplicado):');
  console.log(`  ${duplicado} — ${dup.nombre} ${dup.apellidos}`);
  console.log('SE CONSERVA:');
  console.log(`  ${conservar} — ${keep.nombre} ${keep.apellidos}\n`);

  console.log('Datos resultantes campo por campo:');
  const fusionado = { ...keep };
  for (const campo of CAMPOS) {
    const vKeep = keep[campo];
    const vDup = dup[campo];
    if (vKeep) {
      fusionado[campo] = vKeep;
      const nota = vDup && vDup !== vKeep ? `  (se descarta del duplicado: "${vDup}")` : '';
      console.log(`  ${campo}: "${vKeep}"${nota}`);
    } else if (vDup) {
      fusionado[campo] = vDup;
      console.log(`  ${campo}: "${vDup}"  <- se completa desde el duplicado (estaba vacío)`);
    } else {
      console.log(`  ${campo}: (vacío en ambos)`);
    }
  }

  const [dupInsc, keepInsc] = await Promise.all([
    db.collection('inscripciones').where('whatsapp', '==', duplicado).get(),
    db.collection('inscripciones').where('whatsapp', '==', conservar).get(),
  ]);

  const actividadesConservadas = new Set(keepInsc.docs.map((d) => d.data().activityId));
  const aMover = [];
  const aDescartar = [];
  for (const doc of dupInsc.docs) {
    (actividadesConservadas.has(doc.data().activityId) ? aDescartar : aMover).push(doc);
  }

  console.log(`\nInscripciones del que se conserva: ${keepInsc.size} (no se tocan)`);
  console.log(`Inscripciones del duplicado a MOVER: ${aMover.length}`);
  for (const doc of aMover) {
    const i = doc.data();
    const act = await db.collection('activities').doc(i.activityId).get();
    console.log(`  ${act.exists ? act.data().nombre : i.activityId} — ${i.categoria} / ${i.status}`);
  }
  if (aDescartar.length) {
    console.log(`Inscripciones duplicadas a DESCARTAR (ya existe una en esa misma actividad): ${aDescartar.length}`);
    for (const doc of aDescartar) {
      const i = doc.data();
      const act = await db.collection('activities').doc(i.activityId).get();
      console.log(`  ${act.exists ? act.data().nombre : i.activityId} — ${i.categoria} / ${i.status}`);
    }
  }

  if (!APPLY) {
    console.log('\nEsto fue solo un reporte. Agrega --apply para ejecutar la fusión.');
    return;
  }

  const batch = db.batch();

  batch.set(db.collection('personas').doc(conservar), fusionado);

  for (const doc of aMover) {
    const i = doc.data();
    batch.set(db.collection('inscripciones').doc(`${i.activityId}_${conservar}`), { ...i, whatsapp: conservar });
    batch.delete(doc.ref);
  }
  for (const doc of aDescartar) {
    batch.delete(doc.ref);
  }

  batch.delete(db.collection('personas').doc(duplicado));
  batch.delete(db.collection('personas_publico').doc(duplicado));
  batch.set(db.collection('personas_publico').doc(conservar), {
    nombreCompleto: `${(fusionado.nombre || '').trim()} ${(fusionado.apellidos || '').trim()}`.trim(),
    estaca: fusionado.estaca || '',
  });

  await batch.commit();

  console.log(`\nListo. ${fusionado.nombre} ${fusionado.apellidos} queda solo con el número ${conservar}.`);
  console.log(`  ${aMover.length} inscripción(es) movida(s), ${aDescartar.length} duplicada(s) descartada(s), 1 registro duplicado eliminado.`);
}

await main();
