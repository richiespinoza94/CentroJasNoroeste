import { CATEGORIAS, ESTACAS } from './constants.js';

const CATEGORIA_PLURAL = { Miembro: 'Miembros', Invitado: 'Invitados', Líder: 'Líderes', Staff: 'Staff' };

export function computeStatCards(participants) {
  const confirmados = participants.filter((p) => p.status !== 'pendiente').length;

  return [
    { label: 'Registrados', value: participants.length },
    { label: 'Presentes', value: confirmados },
    { label: 'Pendientes', value: participants.filter((p) => p.status === 'pendiente').length },
    ...CATEGORIAS.map((c) => ({ label: CATEGORIA_PLURAL[c], value: participants.filter((p) => p.categoria === c).length })),
    { label: '% Asistencia', value: participants.length ? `${Math.round((confirmados / participants.length) * 100)}%` : '0%' },
  ];
}

function distribution(participants, key) {
  const counts = {};
  for (const p of participants) counts[p[key]] = (counts[p[key]] || 0) + 1;
  const max = Math.max(1, ...Object.values(counts));
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count, pct: Math.round((count / max) * 100) }));
}

export const computeEstacaDist = (participants) => distribution(participants, 'estaca');

// A diferencia de computeEstacaDist (donde "Otro"/estacas externas SÍ
// importa mostrar — cuánta gente vino de fuera es información real), el
// detalle por barrio solo tiene sentido estructurado dentro de las 3
// estacas del centro. Alguien de "Otro"/una estaca externa que escribió
// "Lomas" como su barrio no es la misma "Las Lomas" de Puente Piedra —
// son lugares distintos que casualmente se parecen en el texto. Antes de
// este filtro, el gráfico los mezclaba como si fueran variantes sin
// fusionar del mismo barrio, cuando en realidad correspondía a personas
// de estacas completamente distintas.
const KNOWN_ESTACAS = new Set(Object.keys(ESTACAS));
export const computeBarrioDist = (participants) => distribution(participants.filter((p) => KNOWN_ESTACAS.has(p.estaca)), 'barrio');
