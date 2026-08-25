export const ESTACAS = {
  Ventanilla: ['Ventanilla', 'Naval', 'Pedro Beltrán', 'Los Álamos', 'Angamos', 'Mi Perú'],
  Miramar: ['Miramar', 'Villas de Ancón', 'Santa Rosa', 'Pachacutec', 'Los Cedros', 'Los Rosales'],
  'Puente Piedra': ['Zapallal 1', 'Zapallal 2', 'Las Lomas', 'Puente Piedra', 'Arenas'],
};

export const NOMBRE_RE = /^[A-Za-zàáéíóúÁÉÍÓÚñÑüÜ\s'\-.]+$/;
export const WHATSAPP_RE = /^9\d{8}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PIN_RE = /^\d{4}$/;

// Lista ampliada — la de antes (7 palabras) se quedaba corta frente a lo que
// realmente escribe la gente cuando no quiere dar su correo. Tomada de la
// misma lógica anti-fake ya probada en producción con el formulario del
// Full Day (Code.gs), no inventada de cero.
export const SUSPICIOUS_EMAIL_WORDS = [
  'notengoemail', 'noemail', 'sinmail', 'notengo', 'tengo',
  'test', 'testing', 'prueba', 'demo', 'example',
  'fake', 'falso', 'dummy', 'placeholder', 'noreal',
  'abc', 'xyz', 'aaa', 'bbb', 'ccc', 'xxx', 'yyy', 'zzz',
  '111', '222', '333', '000', '999',
  'asdf', 'qwerty', 'qweasd', 'zxcvbn', 'qazwsx',
  'admin', 'user', 'pass', 'password', '123', '456',
  'temporal', 'temp', 'aux', 'basura', 'noreply', 'spam',
];

// Patrones de celular claramente inventado — mismo criterio que el Full Day:
// todos el mismo dígito, pares alternados, o un grupo de 2 dígitos repetido.
export const FAKE_WHATSAPP_PATTERNS = [/^9{9}$/, /^9(\d)\1{7}$/, /^9(01|10){4}9?$/, /^9(\d{2})\1{3}$/];

// One standardized category — usada por el formulario público, el registro
// manual, y (antes) las reservas de mesas. Se mantiene un solo vocabulario
// aunque "mesas" ya no viva en el núcleo, por si se reactiva como patch.
export const CATEGORIAS = ['Miembro', 'Invitado', 'Líder', 'Staff'];
// The public self-registration form can only pick these two — nobody
// self-declares as Líder or Staff, that's only set via reception's
// staff-mediated manual registration (see ManualTab.jsx).
export const PUBLIC_CATEGORIAS = ['Miembro', 'Invitado'];

export const STATUS_META = {
  pendiente: { label: 'Pendiente ingreso', bg: 'var(--warn-bg)', color: 'var(--warn-fg)' },
  presente: { label: 'Presente', bg: 'var(--success-bg)', color: 'var(--success-fg)' },
};

export function getStatusMeta(status) {
  return STATUS_META[status] || {
    label: status ? `Estado: ${status}` : 'Estado desconocido',
    bg: 'var(--warn-bg)',
    color: 'var(--warn-fg)',
  };
}

export const ROLE_LABELS = { admin: 'Admin', recepcion: 'Recepción' };

// EVENT_INFO ya no existe como constante fija — cada actividad se crea y
// activa desde Admin → Actividades (ver firebase/collections.js) y se lee
// en tiempo real vía useFirestoreData().activeActivity.
