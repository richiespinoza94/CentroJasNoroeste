// Estandariza `estaca` y `barrio` en `personas` contra la lista canónica
// real de la app (src/domain/constants.js → ESTACAS) — no una copia
// duplicada que se pueda desincronizar.
//
// Por qué hace falta: los datos migrados desde el formulario de Google
// (Full Day) se escribieron a mano en una hoja de cálculo — "Los Alamos"
// vs "Los Álamos", "ventanilla" vs "Ventanilla", espacios de más, etc. El
// formulario de esta app usa un <select> con la lista fija, así que los
// registros hechos DESDE la app ya deberían estar limpios; esto es para
// limpiar lo que entró por otra vía.
//
// Modo por defecto: SOLO REPORTA, no escribe nada. Corre con --apply para
// aplicar las correcciones de confianza alta ("exacta" y "razonable").
// Las que no calzan con nada conocido NUNCA se tocan solas — quedan
// listadas para que las revises a mano (puede ser gente real de un barrio
// que no está en la lista, o alguien que escribió "Otra estaca").
//
// Uso:
//   node --env-file=.env.local scripts/standardize-estaca-barrio.mjs            (reporte)
//   node --env-file=.env.local scripts/standardize-estaca-barrio.mjs --apply    (corrige)
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ESTACAS } from '../src/domain/constants.js';

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');
const ESTACA_NAMES = Object.keys(ESTACAS);

function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Quita un artículo inicial ("los"/"las"/"el"/"la ") — gente que escribe
// "Alamos" en vez de "Los Álamos", o "Lomas" en vez de "Las Lomas", no está
// cometiendo un error de tipeo (la distancia de edición es alta, se
// perdería con el chequeo difuso normal) — está usando la forma corta que
// cualquiera en el barrio entendería. Antes de aplicar esto se verificó
// que, en la lista actual, nunca hay dos barrios de la misma estaca que
// compartan el mismo nombre sin artículo — si esa lista cambia en el
// futuro y eso deja de ser cierto, esta función necesitaría revisarse.
function stripArticle(s) {
  return s.replace(/^(los|las|el|la)\s+/, '');
}

// Distancia de edición simple (Levenshtein) — suficiente para atrapar
// typos de tipeo a mano ("Ventanila", "Pachacutek"), no hace falta nada
// más sofisticado para ~20 nombres conocidos.
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Compara un valor contra una lista de candidatos canónicos.
 * - "exact": coincide ignorando acentos/mayúsculas/espacios de más —
 *   corrección sin ambigüedad (solo cambia la forma de escribirlo).
 * - "fuzzy": no coincide exacto, pero está a 1-2 ediciones de UN solo
 *   candidato — probable typo, se reporta para confirmar.
 * - "none": no se parece a nada conocido — nunca se toca solo.
 */
function findMatch(value, candidates) {
  const nv = normalize(value);
  if (!nv) return { confidence: 'none' };

  const exact = candidates.find((c) => normalize(c) === nv);
  if (exact) return { confidence: exact === value ? 'already-clean' : 'exact', match: exact };

  // "Alamos" -> "Los Álamos", "Lomas" -> "Las Lomas" — no es un typo, es la
  // forma corta de decirlo. Se trata como confianza alta (misma categoría
  // que "exact" para efectos de qué se reporta como seguro de aplicar),
  // no como "fuzzy" — no hay ambigüedad posible, es una coincidencia
  // completa una vez quitado el artículo.
  const noArt = candidates.find((c) => stripArticle(normalize(c)) === nv);
  if (noArt) return { confidence: 'exact', match: noArt, note: 'artículo omitido' };

  const distances = candidates.map((c) => ({ c, d: levenshtein(nv, normalize(c)) }));
  distances.sort((a, b) => a.d - b.d);
  const [best, second] = distances;
  const maxAllowed = Math.max(1, Math.floor(nv.length * 0.3));
  if (best.d <= 2 && best.d <= maxAllowed && (!second || second.d > best.d)) {
    return { confidence: 'fuzzy', match: best.c, distance: best.d };
  }
  return { confidence: 'none' };
}

async function main() {
  console.log(APPLY ? 'Modo: APLICAR correcciones de confianza alta.\n' : 'Modo: SOLO REPORTE (nada se escribe). Corre con --apply para corregir.\n');

  const snap = await db.collection('personas').get();
  console.log(`${snap.size} personas revisadas.\n`);

  const fixes = []; // { ref, whatsapp, field, from, to, confidence }
  const unresolved = []; // { whatsapp, nombre, estaca, barrio, motivo }

  for (const doc of snap.docs) {
    const p = doc.data();
    const whatsapp = doc.id;
    const nombreCompleto = `${p.nombre || ''} ${p.apellidos || ''}`.trim();

    const estacaMatch = findMatch(p.estaca, ESTACA_NAMES);
    if (estacaMatch.confidence === 'none') {
      unresolved.push({ whatsapp, nombreCompleto, estaca: p.estaca, barrio: p.barrio, motivo: `estaca "${p.estaca}" no se parece a ninguna de las 3 conocidas` });
      continue; // sin estaca resuelta no tiene sentido evaluar el barrio contra una lista
    }

    if (estacaMatch.confidence === 'exact' || estacaMatch.confidence === 'fuzzy') {
      fixes.push({ ref: doc.ref, whatsapp, nombreCompleto, field: 'estaca', from: p.estaca, to: estacaMatch.match, confidence: estacaMatch.confidence, distance: estacaMatch.distance });
    }

    const estacaResuelta = estacaMatch.match || p.estaca;
    const barrioMatch = findMatch(p.barrio, ESTACAS[estacaResuelta]);
    if (barrioMatch.confidence === 'none') {
      unresolved.push({ whatsapp, nombreCompleto, estaca: estacaResuelta, barrio: p.barrio, motivo: `barrio "${p.barrio}" no está en la lista de ${estacaResuelta}` });
    } else if (barrioMatch.confidence === 'exact' || barrioMatch.confidence === 'fuzzy') {
      fixes.push({ ref: doc.ref, whatsapp, nombreCompleto, field: 'barrio', from: p.barrio, to: barrioMatch.match, confidence: barrioMatch.confidence, distance: barrioMatch.distance });
    }
  }

  const exactFixes = fixes.filter((f) => f.confidence === 'exact');
  const fuzzyFixes = fixes.filter((f) => f.confidence === 'fuzzy');

  console.log(`=== Correcciones exactas (${exactFixes.length}) — solo difieren en acentos/mayúsculas/espacios ===`);
  exactFixes.forEach((f) => console.log(`  ${f.nombreCompleto} (${f.whatsapp}) — ${f.field}: "${f.from}" → "${f.to}"`));

  console.log(`\n=== Correcciones probables (${fuzzyFixes.length}) — parecido cercano, probable error de tipeo ===`);
  fuzzyFixes.forEach((f) => console.log(`  ${f.nombreCompleto} (${f.whatsapp}) — ${f.field}: "${f.from}" → "${f.to}" (distancia ${f.distance})`));

  console.log(`\n=== Sin resolver (${unresolved.length}) — revisar a mano, nunca se tocan solas ===`);
  unresolved.forEach((u) => console.log(`  ${u.nombreCompleto} (${u.whatsapp}) — ${u.motivo}`));

  if (!APPLY) {
    console.log('\nEsto fue solo un reporte. Corre con --apply para escribir las correcciones exactas y probables.');
    return;
  }

  let applied = 0;
  const batchSize = 400;
  let batch = db.batch();
  let opsInBatch = 0;
  const mirrorUpdates = new Map(); // whatsapp -> { nombreCompleto, estaca } para personas_publico

  for (const f of fixes) {
    batch.update(f.ref, { [f.field]: f.to, updatedAt: FieldValue.serverTimestamp() });
    opsInBatch++;
    applied++;
    if (!mirrorUpdates.has(f.whatsapp)) mirrorUpdates.set(f.whatsapp, {});
    if (f.field === 'estaca') mirrorUpdates.get(f.whatsapp).estaca = f.to;
    if (opsInBatch >= batchSize) {
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
  }
  if (opsInBatch > 0) await batch.commit();

  // El índice público (personas_publico) solo guarda estaca, no barrio —
  // se actualiza aparte si la estaca cambió, para no dejarlo desactualizado.
  let mirrorBatch = db.batch();
  let mirrorOps = 0;
  for (const [whatsapp, changes] of mirrorUpdates) {
    if (!changes.estaca) continue;
    mirrorBatch.set(db.collection('personas_publico').doc(whatsapp), { estaca: changes.estaca }, { merge: true });
    mirrorOps++;
    if (mirrorOps >= batchSize) {
      await mirrorBatch.commit();
      mirrorBatch = db.batch();
      mirrorOps = 0;
    }
  }
  if (mirrorOps > 0) await mirrorBatch.commit();

  console.log(`\n${applied} campos corregidos en personas.`);
}

await main();
