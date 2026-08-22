import * as XLSX from 'xlsx';
import { STATUS_META } from './constants.js';

// Mismas 3 estacas que administra el Centro JAS Noroeste (ver ESTACAS en
// este archivo). Cualquier otro valor es texto libre que alguien escribió
// al elegir "Otra estaca" en el formulario — todo eso cae en "Otros".
const KNOWN_ESTACAS = ['Ventanilla', 'Miramar', 'Puente Piedra'];

const HEADERS = ['Nombre completo', 'Barrio', 'Categoría', 'WhatsApp', 'Estado'];

function participantRow(p) {
  return [`${p.nombre} ${p.apellidos}`, p.barrio, p.categoria, p.whatsapp, STATUS_META[p.status]?.label || p.status];
}

/**
 * Arma un libro de Excel con una pestaña por estaca (Ventanilla, Miramar,
 * Puente Piedra, Otros) — la estaca ya es el nombre de la pestaña, así que
 * no hace falta repetirla como columna en cada fila.
 */
export function buildParticipantsWorkbook(participants) {
  const groups = { Ventanilla: [], Miramar: [], 'Puente Piedra': [], Otros: [] };
  for (const p of participants) {
    const key = KNOWN_ESTACAS.includes(p.estaca) ? p.estaca : 'Otros';
    groups[key].push(p);
  }

  const wb = XLSX.utils.book_new();
  for (const [estaca, list] of Object.entries(groups)) {
    const rows = list.map((p) => participantRow(p));
    const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
    ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, estaca);
  }
  return wb;
}

/** Arma el libro y dispara la descarga — el único punto del código que sabe que el reporte se genera con la librería xlsx. */
export function downloadParticipantsReport(participants, activityLabel = 'centro-jas') {
  const wb = buildParticipantsWorkbook(participants);
  const fecha = new Date().toISOString().slice(0, 10);
  const slug = activityLabel
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  XLSX.writeFile(wb, `${slug || 'centro-jas'}-registrados-${fecha}.xlsx`);
}
