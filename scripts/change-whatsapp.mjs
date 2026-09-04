// Cambia el número de WhatsApp de una persona — por ejemplo, alguien que
// se registró con un número falso ("999999991") y después dio el real.
//
// Por qué hace falta un script y no se puede desde la app: el WhatsApp es
// el ID del documento (`personas/{whatsapp}`), no un campo editable. Eso es
// lo que hace que "no hay dos registros con el mismo número" sea una
// garantía atómica en vez de una consulta con condición de carrera — pero
// también significa que cambiarlo implica MOVER documentos, no editarlos:
//   personas/{viejo}                    -> personas/{nuevo}
//   inscripciones/{actividad}_{viejo}   -> inscripciones/{actividad}_{nuevo}   (una por actividad)
//   personas_publico/{viejo}            -> personas_publico/{nuevo}
// Además, las reglas prohíben borrar (allow delete: if false) a propósito,
// así que solo el SDK de administrador puede completar la operación.
//
// Modo por defecto: SOLO REPORTE, no escribe nada. Corre con --apply.
//
// Uso:
//   node --env-file=.env.local scripts/change-whatsapp.mjs 999999991 922780896
//   node --env-file=.env.local scripts/change-whatsapp.mjs 999999991 922780896 --apply
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const [, , viejo, nuevo] = process.argv;
const APPLY = process.argv.includes('--apply');
const WHATSAPP_RE = /^9\d{8}$/;

async function main() {
  if (!viejo || !nuevo || viejo.startsWith('--') || nuevo.startsWith('--')) {
    console.error('Uso: node --env-file=.env.local scripts/change-whatsapp.mjs <numero-viejo> <numero-nuevo> [--apply]');
    process.exit(1);
  }
  if (!WHATSAPP_RE.test(nuevo)) {
    console.error(`El número nuevo "${nuevo}" no tiene el formato válido (9 dígitos, empieza con 9).`);
    process.exit(1);
  }
  if (viejo === nuevo) {
    console.error('El número viejo y el nuevo son iguales — nada que hacer.');
    process.exit(1);
  }

  console.log(APPLY ? 'Modo: APLICAR el cambio.\n' : 'Modo: SOLO REPORTE (nada se escribe). Agrega --apply para ejecutarlo.\n');

  const personaVieja = await db.collection('personas').doc(viejo).get();
  if (!personaVieja.exists) {
    console.error(`No existe ninguna persona con el número "${viejo}".`);
    process.exit(1);
  }
  const datos = personaVieja.data();
  console.log(`Persona: ${datos.nombre} ${datos.apellidos}`);
  console.log(`  ${viejo}  ->  ${nuevo}`);
  console.log(`  estaca: ${datos.estaca} | barrio: ${datos.barrio}\n`);

  // Si el número nuevo YA pertenece a otra persona, esto dejaría de ser un
  // "cambio de número" y pasaría a ser una fusión de dos identidades —
  // decidir cuáles datos ganan, qué pasa si ambos fueron a la misma
  // actividad, etc. Eso necesita criterio humano, así que se detiene aquí
  // en vez de adivinar y pisar datos de alguien más.
  const personaNueva = await db.collection('personas').doc(nuevo).get();
  if (personaNueva.exists) {
    const d = personaNueva.data();
    console.error(`⚠ El número "${nuevo}" YA pertenece a: ${d.nombre} ${d.apellidos} (${d.estaca}).`);
    console.error('  Esto sería fusionar dos personas, no cambiar un número — se detiene por seguridad.');
    console.error('  Si de verdad son la misma persona duplicada, avisa para resolverlo caso por caso.');
    process.exit(1);
  }

  const inscripcionesSnap = await db.collection('inscripciones').where('whatsapp', '==', viejo).get();
  console.log(`Inscripciones a mover: ${inscripcionesSnap.size}`);
  for (const doc of inscripcionesSnap.docs) {
    const i = doc.data();
    const act = await db.collection('activities').doc(i.activityId).get();
    console.log(`  ${act.exists ? act.data().nombre : i.activityId} — ${i.categoria} / ${i.status}`);
  }

  const publicoViejo = await db.collection('personas_publico').doc(viejo).get();
  console.log(`\nÍndice público: ${publicoViejo.exists ? 'sí tiene entrada, se moverá' : 'no tiene entrada'}`);

  if (!APPLY) {
    console.log('\nEsto fue solo un reporte. Agrega --apply para ejecutar el cambio.');
    return;
  }

  // Todo en un batch: o se mueve completo, o no se mueve nada. Sin esto,
  // una falla a mitad de camino dejaría a la persona con la mitad de sus
  // inscripciones en un número y la otra mitad en otro.
  const batch = db.batch();

  batch.set(db.collection('personas').doc(nuevo), datos);
  batch.delete(db.collection('personas').doc(viejo));

  for (const doc of inscripcionesSnap.docs) {
    const i = doc.data();
    batch.set(db.collection('inscripciones').doc(`${i.activityId}_${nuevo}`), { ...i, whatsapp: nuevo });
    batch.delete(doc.ref);
  }

  if (publicoViejo.exists) {
    batch.set(db.collection('personas_publico').doc(nuevo), publicoViejo.data());
    batch.delete(db.collection('personas_publico').doc(viejo));
  }

  await batch.commit();

  console.log(`\nListo. ${datos.nombre} ${datos.apellidos} ahora tiene el número ${nuevo}.`);
  console.log(`  1 persona + ${inscripcionesSnap.size} inscripción(es)${publicoViejo.exists ? ' + índice público' : ''} movidos.`);
}

await main();
