import { NOMBRE_RE, WHATSAPP_RE, EMAIL_RE, SUSPICIOUS_EMAIL_WORDS, FAKE_WHATSAPP_PATTERNS, PUBLIC_CATEGORIAS } from './constants.js';

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

// Detecta patrones de "ruido" — teclado mal aplastado, o el mismo carácter
// repetido 4+ veces seguidas. Misma idea que ya se probó en producción en
// el formulario del Full Day (Code.gs), portada aquí en vez de reinventarla.
function hasNoisePattern(s) {
  return /qwerty|asdfgh|zxcvbn|qazwsx/i.test(s) || /(.)\1{3,}/i.test(s);
}

/**
 * Valida que un nombre/apellido "se sienta" real, más allá de solo aceptar
 * letras: detecta alternancia rara de mayúsculas (ej. "aSdFqWeR"), muy pocas
 * vocales para su longitud, una racha larga de consonantes seguidas, o
 * ruido de teclado — los mismos criterios que ya se probaron en vivo con el
 * Full Day, no una heurística nueva sin probar.
 */
function nameQualityError(s, { minLen, maxLen, maxConsonantRun }) {
  if (s.length < minLen) return `Mínimo ${minLen} caracteres.`;
  if (s.length > maxLen) return `Máximo ${maxLen} caracteres.`;
  if (!NOMBRE_RE.test(s)) return 'Solo letras (sin números ni símbolos).';

  const especiales = (s.match(/['\-.]/g) || []).length;
  if (especiales > 3) return 'Demasiados caracteres especiales.';
  if (/([a-z][A-Z]){3,}/.test(s)) return 'Este texto no parece un nombre real.';

  const sinEspacios = s.replace(/\s/g, '').toLowerCase();
  if (sinEspacios.length === 0) return `Mínimo ${minLen} caracteres.`;

  const vocales = (sinEspacios.match(/[aeiouáéíóú]/g) || []).length;
  if (vocales / sinEspacios.length < 0.15) return 'Este texto no parece un nombre real.';

  const consonanteRun = new RegExp(`[bcdfghjklmnpqrstvwxyzñ]{${maxConsonantRun},}`, 'i');
  if (consonanteRun.test(sinEspacios)) return 'Este texto no parece un nombre real.';
  if (hasNoisePattern(sinEspacios)) return 'Este texto no parece un nombre real.';

  return null;
}

/**
 * Misma idea que nameQualityError, pero para la parte antes del @ de un
 * correo: alternancia rara de mayúsculas, caracteres repetidos, demasiados
 * números seguidos, o casi todo números — portado del Full Day.
 */
function correoQualityError(correo) {
  if (!EMAIL_RE.test(correo)) return 'Correo no válido.';

  const local = correo.split('@')[0].toLowerCase();
  if (SUSPICIOUS_EMAIL_WORDS.some((w) => local.includes(w))) return 'Este correo no parece válido.';
  if (/(.)\1{3,}/i.test(local)) return 'Este correo tiene demasiados caracteres repetidos.';
  if (/\d{4,}/.test(local)) return 'Demasiados números seguidos en el correo.';

  const soloNumeros = local.replace(/[^0-9]/g, '').length;
  if (soloNumeros / local.length > 0.6) return 'Este correo no parece válido.';
  if (local.length < 3) return 'El correo es muy corto.';
  if (local.length > 50) return 'El correo es muy largo.';

  return null;
}

/**
 * Validates the public registration form.
 * @returns {Record<string, string>} field -> error message (empty object = valid)
 */
export function validateRegistration(form, participants) {
  const e = {};

  const nombre = form.nombre.trim();
  const errNombre = nameQualityError(nombre, { minLen: 2, maxLen: 40, maxConsonantRun: 6 });
  if (errNombre) e.nombre = errNombre;

  const ap = form.apellidos.trim();
  const errApellidos = nameQualityError(ap, { minLen: 2, maxLen: 50, maxConsonantRun: 7 });
  if (errApellidos) e.apellidos = errApellidos;

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
  } else if (FAKE_WHATSAPP_PATTERNS.some((re) => re.test(form.whatsapp))) {
    e.whatsapp = 'Este número no parece real — revísalo.';
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
    const errCorreo = correoQualityError(form.correo);
    if (errCorreo) e.correo = errCorreo;
  }

  if (!form.privacidad) e.privacidad = 'Debes aceptar la política de privacidad.';

  return e;
}

// El registro manual lo hace el staff en recepción, no el público — se
// mantiene la validación básica (obligatorios + formato) sin las
// heurísticas anti-fake, porque ahí el riesgo de spam/troleo no existe y
// esas reglas podrían estorbar con un nombre real pero poco común.
export function validateManual(m, participants) {
  if (!m.nombre.trim() || !m.apellidos.trim()) return 'Nombre y apellidos son obligatorios.';
  if (!WHATSAPP_RE.test(m.whatsapp)) return 'WhatsApp inválido (9 dígitos, empieza con 9).';
  if (participants.find((p) => p.whatsapp === m.whatsapp)) return 'Ya existe un registro con este número.';
  if (!m.estaca || !m.barrio.trim()) return 'Estaca y barrio son obligatorios.';
  return null;
}
