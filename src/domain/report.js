import * as XLSX from 'xlsx';
import { STATUS_META } from './constants.js';
import { ageFromDate } from './validation.js';

// Mismas 3 estacas que administra el Centro JAS Noroeste (ver ESTACAS en
// constants.js). Cualquier otro valor es texto libre que alguien escribió
// al elegir "Otra estaca" en el formulario — todo eso cae en "Otros".
const KNOWN_ESTACAS = ['Ventanilla', 'Miramar', 'Puente Piedra'];

const HEADERS = [
  'Nombre',
  'Apellidos',
  'Sexo',
  'Fecha de nacimiento',
  'Edad',
  'Estaca',
  'Barrio',
  'Categoría',
  'WhatsApp',
  'Correo',
  'Estado',
  'Fecha de registro',
  'Fecha de asistencia',
];

// Firestore entrega Timestamp (con .toDate()), pero los registros migrados
// por script pueden traer un Date normal, y los recién escritos pueden
// llegar como null por un instante mientras serverTimestamp() se resuelve.
// Se contemplan los tres casos en vez de asumir uno solo.
function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// La fecha de nacimiento se guarda como "YYYY-MM-DD" (formato del <input
// type="date">). Se muestra en dd/mm/aaaa, que es como se lee en Perú.
function formatBirthDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function participantRow(p) {
  const edad = ageFromDate(p.fechaNacimiento);
  return [
    p.nombre || '',
    p.apellidos || '',
    p.sexo || '',
    formatBirthDate(p.fechaNacimiento),
    // Las edades son enteras por naturaleza — ageFromDate ya devuelve un
    // entero, y se deja como número (no texto) para que Excel pueda
    // promediar/filtrar sin conversiones.
    edad === null ? '' : edad,
    p.estaca || '',
    p.barrio || '',
    p.categoria || '',
    p.whatsapp || '',
    p.correo || '',
    STATUS_META[p.status]?.label || p.status || '',
    formatDateTime(p.createdAt),
    // Solo tiene sentido para quien efectivamente asistió. Para el
    // formulario público coincide con el registro (se marca presente al
    // inscribirse, porque se llena estando en el lugar); para un check-in
    // hecho en recepción es el momento en que se confirmó la llegada.
    p.status === 'presente' ? formatDateTime(p.updatedAt || p.createdAt) : '',
  ];
}

const COL_WIDTHS = [
  { wch: 18 }, // Nombre
  { wch: 22 }, // Apellidos
  { wch: 6 }, // Sexo
  { wch: 18 }, // Fecha de nacimiento
  { wch: 6 }, // Edad
  { wch: 16 }, // Estaca
  { wch: 16 }, // Barrio
  { wch: 11 }, // Categoría
  { wch: 12 }, // WhatsApp
  { wch: 28 }, // Correo
  { wch: 16 }, // Estado
  { wch: 18 }, // Fecha de registro
  { wch: 18 }, // Fecha de asistencia
];

function sheetFrom(list) {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...list.map(participantRow)]);
  ws['!cols'] = COL_WIDTHS;
  // Congela la fila de encabezados — con 13 columnas y cientos de filas,
  // desplazarse sin referencia vuelve la hoja difícil de leer.
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: list.length, c: HEADERS.length - 1 } }) };
  return ws;
}

/**
 * Arma un libro de Excel con una pestaña "Todos" (para filtrar/tabular
 * sobre el total sin tener que unir hojas a mano) más una pestaña por
 * estaca: Ventanilla, Miramar, Puente Piedra y Otros.
 */
export function buildParticipantsWorkbook(participants) {
  const groups = { Ventanilla: [], Miramar: [], 'Puente Piedra': [], Otros: [] };
  for (const p of participants) {
    const key = KNOWN_ESTACAS.includes(p.estaca) ? p.estaca : 'Otros';
    groups[key].push(p);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFrom(participants), 'Todos');
  for (const [estaca, list] of Object.entries(groups)) {
    XLSX.utils.book_append_sheet(wb, sheetFrom(list), estaca);
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
