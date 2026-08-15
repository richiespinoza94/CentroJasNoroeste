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

export const DEFAULT_USERS = [
  { username: 'admin', role: 'admin', pin: '1234' },
  { username: 'fiorella', role: 'recepcion', pin: null },
  { username: 'renzo', role: 'recepcion', pin: null },
];

export const SEED_PARTICIPANTS = [
  { id: 1, nombre: 'Sofía', apellidos: 'Ramírez Torres', sexo: 'F', tipoParticipante: 'Miembro', whatsapp: '955123456', estaca: 'Ventanilla', barrio: 'Naval', correo: '', categoria: 'participante', status: 'asignado', tableId: 1 },
  { id: 2, nombre: 'Jorge Luis', apellidos: 'Mendoza Paredes', sexo: 'M', tipoParticipante: 'Invitado', whatsapp: '944556677', estaca: 'Miramar', barrio: 'Santa Rosa', correo: '', categoria: 'participante', status: 'presente', tableId: null },
  { id: 3, nombre: 'Valeria', apellidos: 'Chumpitaz Rojas', sexo: 'F', tipoParticipante: 'Miembro', whatsapp: '987001122', estaca: 'Puente Piedra', barrio: 'Zapallal 1', correo: '', categoria: 'participante', status: 'pendiente', tableId: null },
  { id: 4, nombre: 'Andrés', apellidos: 'Salazar Ibáñez', sexo: 'M', tipoParticipante: 'Miembro', whatsapp: '966334455', estaca: 'Ventanilla', barrio: 'Angamos', correo: '', categoria: 'staff', status: 'asignado', tableId: 1 },
  { id: 5, nombre: 'Camila', apellidos: 'Ortiz Delgado', sexo: 'F', tipoParticipante: 'Invitado', whatsapp: '978112233', estaca: 'Miramar', barrio: 'Pachacutec', correo: '', categoria: 'programa', status: 'asignado', tableId: 9 },
  { id: 6, nombre: 'Diego', apellidos: 'Fernández Quispe', sexo: 'M', tipoParticipante: 'Miembro', whatsapp: '933445566', estaca: 'Puente Piedra', barrio: 'Las Lomas', correo: '', categoria: 'participante', status: 'pendiente', tableId: null },
];

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
