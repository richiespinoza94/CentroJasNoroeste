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
  { id: 9, name: 'Mesa Líderes', capacity: 8, reservedFor: 'Líder' },
];

// One standardized category, used identically in the registration form,
// manual registration, and table reservations — no more separate "tipo"
// (Miembro/Invitado) vs "categoría de mesa" (participante/programa/staff)
// vocabularies that only partially overlapped.
export const CATEGORIAS = ['Miembro', 'Invitado', 'Líder', 'Staff'];
// The public self-registration form can only pick these two — nobody
// self-declares as Líder or Staff, that's only set via reception's
// staff-mediated manual registration (see ManualTab.jsx).
export const PUBLIC_CATEGORIAS = ['Miembro', 'Invitado'];
// Table "reservedFor" values a table can be locked to. Same vocabulary as
// CATEGORIAS on purpose — a table's reservedFor is checked directly against
// a person's categoria (domain/tables.js), no translation layer needed.
export const RESERVABLE_CATEGORIAS = ['Líder', 'Staff', 'Invitado'];

export const STATUS_META = {
  pendiente: { label: 'Pendiente ingreso', bg: 'var(--warn-bg)', color: 'var(--warn-fg)' },
  presente: { label: 'Presente', bg: 'var(--navy-100)', color: 'var(--navy-800)' },
  asignado: { label: 'Asignado a mesa', bg: 'var(--success-bg)', color: 'var(--success-fg)' },
  sin_mesa: { label: 'Staff · sin mesa', bg: 'var(--panel-50)', color: 'var(--ink-500)' },
};

export const ROLE_LABELS = { admin: 'Admin', recepcion: 'Recepción' };

// EVENT_INFO ya no existe como constante fija — cada actividad se crea y
// activa desde Admin → Actividades (ver firebase/collections.js) y se lee
// en tiempo real vía useFirestoreData().activeActivity.
