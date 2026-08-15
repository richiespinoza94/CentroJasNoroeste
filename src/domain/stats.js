import { occupancyByTable } from './tables.js';
import { RESERVED_LABELS } from './constants.js';

export function computeStatCards(participants, tables) {
  const capacidadTotal = tables.reduce((a, t) => a + t.capacity, 0);
  const ocupados = participants.filter((p) => p.tableId).length;
  const confirmados = participants.filter((p) => p.status !== 'pendiente').length;
  const occ = occupancyByTable(participants);
  const mesasCompletas = tables.filter((t) => (occ[t.id] || 0) >= t.capacity).length;

  return [
    { label: 'Registrados', value: participants.length },
    { label: 'Presentes', value: confirmados },
    { label: 'Pendientes', value: participants.filter((p) => p.status === 'pendiente').length },
    { label: 'Participantes', value: participants.filter((p) => p.categoria === 'participante').length },
    { label: 'Programa', value: participants.filter((p) => p.categoria === 'programa').length },
    { label: 'Staff', value: participants.filter((p) => p.categoria === 'staff').length },
    { label: 'Capacidad total', value: capacidadTotal },
    { label: 'Espacios ocupados', value: ocupados },
    { label: 'Espacios libres', value: capacidadTotal - ocupados },
    { label: 'Mesas completas', value: mesasCompletas },
    { label: '% Asistencia', value: participants.length ? `${Math.round((confirmados / participants.length) * 100)}%` : '0%' },
  ];
}

export function computeTableCards(participants, tables) {
  const occByTable = occupancyByTable(participants);
  return tables.map((t) => {
    const occ = occByTable[t.id] || 0;
    const left = t.capacity - occ;
    const pct = Math.round((occ / t.capacity) * 100);
    let accentColor = 'var(--success-500)';
    let statusColor = 'var(--success-fg)';
    let statusLabel = `${left} disponibles`;
    if (left === 0) {
      accentColor = 'var(--ink-200)';
      statusColor = 'var(--ink-300)';
      statusLabel = 'Completa';
    } else if (left <= 2) {
      accentColor = 'var(--gold-500)';
      statusColor = 'var(--gold-700)';
      statusLabel = `${left} disponibles`;
    }
    if (t.reservedFor) {
      accentColor = 'var(--gold-500)';
      statusLabel = `${RESERVED_LABELS[t.reservedFor]} · ${statusLabel}`;
    }
    return { id: t.id, name: t.name, capacity: t.capacity, occ, pct, accentColor, statusColor, statusLabel };
  });
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
export const computeBarrioDist = (participants) => distribution(participants, 'barrio');
