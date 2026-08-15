export const ESTACAS = {
  Ventanilla: ['Ventanilla', 'Naval', 'Pedro Beltrán', 'Los Álamos', 'Angamos', 'Mi Perú'],
  Miramar: ['Miramar', 'Villas de Ancón', 'Santa Rosa', 'Pachacutec', 'Los Cedros', 'Los Rosales'],
  'Puente Piedra': ['Zapallal 1', 'Zapallal 2', 'Las Lomas', 'Puente Piedra', 'Arenas'],
};

export const NOMBRE_RE = /^[A-Za-zàáéíóúÁÉÍÓÚñÑüÜ\s'\-.]+$/;
export const WHATSAPP_RE = /^9\d{8}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PIN_RE = /^\d{4}$/;
export const SUSPICIOUS_EMAIL_WORDS = ['test', 'fake', 'spam', 'asdf', 'temp', 'noreply', 'xxx'];

export const DEFAULT_TABLES = [
  { id: 1, name: 'Mesa 1', capacity: 10, reservedFor: null },
  { id: 2, name: 'Mesa 2', capacity: 10, reservedFor: null },
  { id: 3, name: 'Mesa 3', capacity: 10, reservedFor: null },
  { id: 4, name: 'Mesa 4', capacity: 10, reservedFor: null },
  { id: 5, name: 'Mesa 5', capacity: 10, reservedFor: null },
  { id: 6, name: 'Mesa 6', capacity: 10, reservedFor: null },
  { id: 7, name: 'Mesa 7', capacity: 10, reservedFor: null },
  { id: 8, name: 'Mesa 8', capacity: 10, reservedFor: null },
  { id: 9, name: 'Mesa Programa', capacity: 8, reservedFor: 'programa' },
];

export const RESERVED_LABELS = { staff: 'Staff', programa: 'Programa', invitado: 'Invitados' };

export const STATUS_META = {
  pendiente: { label: 'Pendiente ingreso', bg: 'var(--warn-bg)', color: 'var(--warn-fg)' },
  presente: { label: 'Presente', bg: 'var(--navy-100)', color: 'var(--navy-800)' },
  asignado: { label: 'Asignado a mesa', bg: 'var(--success-bg)', color: 'var(--success-fg)' },
};

export const CATEGORY_META = { participante: 'Participante', staff: 'Staff', programa: 'Programa' };
export const ROLE_LABELS = { admin: 'Admin', recepcion: 'Recepción' };

export const EVENT_INFO = {
  name: 'La Velada 2026',
  date: '15/08/2026',
  estaca: 'Estaca Ventanilla',
  anfitrion: 'Centro JAS Noroeste',
};
