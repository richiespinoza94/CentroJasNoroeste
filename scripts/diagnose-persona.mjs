// Diagnóstico puntual — busca por nombre (no exacto, por substring) tanto
// en `personas` (el directorio real) como en `personas_publico` (el índice
// que alimenta el aviso "¿eres tú?" del formulario). Si alguien está en el
// primero pero NO en el segundo, ese es el motivo por el que el formulario
// no lo detecta — no corrige nada, solo muestra qué hay.
//
// Uso: node --env-file=.env.local scripts/diagnose-persona.mjs "Denis Ramos"
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function main() {
  const query = process.argv[2];
  if (!query) {
    console.error('Uso: node --env-file=.env.local scripts/diagnose-persona.mjs "Nombre Apellido"');
    process.exit(1);
  }
  const words = normalize(query).split(/\s+/).filter(Boolean);

  const [personasSnap, publicoSnap, activitiesSnap] = await Promise.all([
    db.collection('personas').get(),
    db.collection('personas_publico').get(),
    db.collection('activities').get(),
  ]);

  const activeActivity = activitiesSnap.docs.find((d) => d.data().activa);

  const matches = personasSnap.docs.filter((d) => {
    const nombreCompleto = normalize(`${d.data().nombre} ${d.data().apellidos}`);
    return words.every((w) => nombreCompleto.includes(w));
  });

  console.log(`Buscando "${query}" — ${matches.length} coincidencia(s) en personas:\n`);

  for (const doc of matches) {
    const p = doc.data();
    const whatsapp = doc.id;
    const enPublico = publicoSnap.docs.find((d) => d.id === whatsapp);

    console.log(`${p.nombre} ${p.apellidos} (${whatsapp})`);
    console.log(`  estaca: "${p.estaca}" | barrio: "${p.barrio}"`);
    console.log(`  ¿está en personas_publico?: ${enPublico ? 'SÍ — ' + JSON.stringify(enPublico.data()) : 'NO — por eso el formulario no lo detecta'}`);

    if (activeActivity) {
      const inscripcionId = `${activeActivity.id}_${whatsapp}`;
      const inscripcionSnap = await db.collection('inscripciones').doc(inscripcionId).get();
      console.log(
        `  ¿ya tiene inscripción en la actividad activa (${activeActivity.data().nombre})?: ${
          inscripcionSnap.exists ? 'SÍ — ' + JSON.stringify(inscripcionSnap.data()) : 'NO'
        }`
      );
    }
    console.log();
  }

  if (matches.length === 0) {
    console.log('No se encontró a nadie con ese nombre en personas — puede que el registro nunca se haya guardado.');
  }
}

await main();
