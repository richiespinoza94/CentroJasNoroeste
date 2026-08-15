import { NOMBRE_RE, WHATSAPP_RE, EMAIL_RE, SUSPICIOUS_EMAIL_WORDS, PUBLIC_CATEGORIAS } from './constants.js';

export function ageFromDate(str) {
  if (!str) return null;
  const b = new Date(str);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

/**
 * Validates the public registration form.
 * @returns {Record<string, string>} field -> error message (empty object = valid)
 */
export function validateRegistration(form, participants) {
  const e = {};

  const nombre = form.nombre.trim();
  if (nombre.length < 2 || nombre.length > 40 || !NOMBRE_RE.test(nombre)) {
    e.nombre = 'Ingresa 2-40 caracteres, solo letras.';
  }

  const ap = form.apellidos.trim();
  if (ap.length < 2 || ap.length > 50 || !NOMBRE_RE.test(ap)) {
    e.apellidos = 'Ingresa 2-50 caracteres, solo letras.';
  }

  if (!form.fechaNacimiento) {
    e.fechaNacimiento = 'Campo obligatorio.';
  } else {
    const age = ageFromDate(form.fechaNacimiento);
    if (age === null || age < 18 || age > 35) e.fechaNacimiento = 'Debes tener entre 18 y 35 años.';
  }

  if (!form.sexo) e.sexo = 'Selecciona una opción.';
  if (!PUBLIC_CATEGORIAS.includes(form.categoria)) e.categoria = 'Selecciona una opción.';

  if (!WHATSAPP_RE.test(form.whatsapp)) {
    e.whatsapp = 'Debe tener 9 dígitos y empezar con 9.';
  } else {
    const dup = participants.find((p) => p.whatsapp === form.whatsapp);
    if (dup) e.whatsapp = `Ya existe un registro con este número (${dup.nombre} ${dup.apellidos}).`;
  }

  if (!form.estaca) e.estaca = 'Selecciona una estaca.';
  if (form.estaca === 'Otra estaca' && (!form.estacaOtra || form.estacaOtra.trim().length < 3)) {
    e.estacaOtra = 'Mínimo 3 caracteres.';
  }

  if (!form.barrio || form.barrio.trim().length < 2) e.barrio = 'Ingresa tu barrio o rama.';

  if (form.correo) {
    if (!EMAIL_RE.test(form.correo)) {
      e.correo = 'Correo no válido.';
    } else {
      const local = form.correo.split('@')[0].toLowerCase();
      if (SUSPICIOUS_EMAIL_WORDS.some((w) => local.includes(w))) e.correo = 'Este correo parece no válido.';
    }
  }

  if (!form.privacidad) e.privacidad = 'Debes aceptar la política de privacidad.';

  return e;
}

export function validateManual(m, participants) {
  if (!m.nombre.trim() || !m.apellidos.trim()) return 'Nombre y apellidos son obligatorios.';
  if (!WHATSAPP_RE.test(m.whatsapp)) return 'WhatsApp inválido (9 dígitos, empieza con 9).';
  if (participants.find((p) => p.whatsapp === m.whatsapp)) return 'Ya existe un registro con este número.';
  if (!m.estaca || !m.barrio.trim()) return 'Estaca y barrio son obligatorios.';
  return null;
}
