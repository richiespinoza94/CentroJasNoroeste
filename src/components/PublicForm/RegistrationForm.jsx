import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store.jsx';
import { useFirestoreData } from '../../firebase/DataProvider.jsx';
import { ESTACAS, PUBLIC_CATEGORIAS } from '../../domain/constants.js';
import { validateRegistration } from '../../domain/validation.js';
import { DUPLICATE_REGISTRATION_CODE, registerParticipant, subscribePublicIndex, fetchPersonaByWhatsapp } from '../../firebase/collections.js';
import logoUrl from '../../assets/logo.png';
import Field from '../ui/Field.jsx';
import { AlertIcon } from '../ui/Icon.jsx';
import './RegistrationForm.css';

const FIELD_ORDER = ['nombre', 'apellidos', 'fechaNacimiento', 'sexo', 'categoria', 'whatsapp', 'estaca', 'estacaOtra', 'barrio', 'correo', 'privacidad'];

function ActivityLoadingCard({ message }) {
  return (
    <div className="reg-form__loading-card" role="status" aria-live="polite">
      <div className="reg-form__loading-brand">
        <div className="reg-form__loading-logo" aria-hidden="true">
          <img src={logoUrl} alt="" />
        </div>
        <div className="reg-form__loading-copy">
          <div className="reg-form__loading-eyebrow">Centro JAS Noroeste</div>
          <div className="reg-form__loading-title">Preparando tu registro</div>
          <div className="reg-form__loading-text">{message}</div>
        </div>
      </div>

      <div className="reg-form__loading-bar" aria-hidden="true">
        <span />
      </div>

      <div className="reg-form__loading-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

// Normaliza acentos/mayúsculas — mismo patrón usado en el buscador de
// Admin → Personas y en el checkin.html del Full Day.
function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Muestra los primeros 2 y los últimos 2 dígitos, oculta el resto — así
// alguien que escribe nombres al azar para "pescar" el número de otra
// persona (con solo confirmar "¿eres tú?" a un nombre que no es el suyo)
// no puede leerlo en pantalla. El valor real completo sigue viajando en el
// registro — esto es solo lo que se ve en el campo.
function maskWhatsapp(w) {
  if (!w || w.length !== 9) return w;
  return `${w.slice(0, 2)}•••••${w.slice(-2)}`;
}

export default function RegistrationForm() {
  const { state, dispatch } = useStore();
  const { activeActivity, activities, activitiesLoading } = useFirestoreData();
  // Un QR debe apuntar siempre a LA MISMA actividad, aunque después se
  // active otra distinta — por eso ?actividad=<id> en la URL manda sobre
  // "la actividad activa ahora" cuando está presente. Sin el parámetro
  // (visita directa a la app), se usa la actividad activa como hasta ahora.
  const activityIdParam = useMemo(() => new URLSearchParams(window.location.search).get('actividad'), []);
  const targetActivity = (activityIdParam && activities.find((a) => a.id === activityIdParam)) || activeActivity;
  const { form, touched, attempted } = state;
  const refs = useRef({});
  const [submitting, setSubmitting] = useState(false);
  // "Ya existe un registro" can only be known once Firestore rejects the
  // write — the public form has no read access to the participant list
  // (by design, see firestore.rules), so this can't be a live field check
  // the way the other validations are.
  const [serverError, setServerError] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Índice público mínimo (nombre + estaca, ver collections.js) para avisar
  // "ya vimos a alguien parecido" — nunca autocompleta, nunca bloquea.
  //
  // Se pide recién cuando la persona ya escribió suficiente nombre+apellidos
  // como para que la comparación tenga sentido (mismo umbral que usa
  // possibleMatch más abajo) — no apenas se monta el formulario. En el
  // arranque en frío, esa lectura completa de la colección competía por
  // ancho de banda con la fuente/el logo/el bundle de JS para una función
  // que la mayoría de visitas nunca llega a usar (alguien que abandona
  // antes de escribir su nombre, o que solo escanea para ver de qué se
  // trata). Diferirlo no cambia el número de lecturas para quien sí llena
  // el formulario, pero saca esa lectura del camino crítico de "que el
  // formulario se vea rápido".
  const [publicIndex, setPublicIndex] = useState([]);
  const [indexRequested, setIndexRequested] = useState(false);
  const [matchDismissed, setMatchDismissed] = useState(false);
  const nombreCompletoLen = normalize(`${form.nombre} ${form.apellidos}`).length;
  useEffect(() => {
    if (indexRequested || nombreCompletoLen < 6) return;
    setIndexRequested(true);
    subscribePublicIndex().then(setPublicIndex).catch(() => {});
  }, [indexRequested, nombreCompletoLen]);

  const errors = useMemo(() => validateRegistration(form, []), [form]);
  const errorCount = Object.keys(errors).length;
  const showErr = (field) => ((attempted || touched[field]) ? errors[field] : undefined);

  const setForm = (patch) => {
    if (patch.whatsapp !== undefined) setServerError('');
    if (submitError) setSubmitError('');
    dispatch({ type: 'SET_FORM', patch });
  };
  const touch = (field) => dispatch({ type: 'TOUCH_FIELD', field });

  const barrioOptions = ESTACAS[form.estaca] || [];
  const showBarrioSelect = !!form.estaca && form.estaca !== 'Otra estaca';
  const showBarrioInput = form.estaca === 'Otra estaca';

  // Solo avisa con coincidencia fuerte (nombre completo casi exacto) — el
  // objetivo es evitar duplicar identidad, no generar ruido con nombres
  // comunes a medio escribir. Deja de avisar en cuanto la persona confirma
  // o descarta, aunque siga editando el nombre después.
  const [matchResolved, setMatchResolved] = useState(false);
  const [confirmingMatch, setConfirmingMatch] = useState(false);
  // Una vez confirmado, el WhatsApp queda fijo y enmascarado en pantalla —
  // ver maskWhatsapp arriba. El resto de los campos SÍ quedan editables:
  // los datos de un registro anterior pueden estar desactualizados (cambió
  // de estaca, de correo, etc.), pero el número es lo único que existe
  // específicamente para evitar duplicar identidad, así que ese no se toca.
  const [whatsappLocked, setWhatsappLocked] = useState(false);
  // Coincide por CONJUNTO de palabras, no por el string completo idéntico
  // — la mayoría de la gente en Perú tiene nombre compuesto y doble
  // apellido, pero escribe una versión corta al registrarse ("Luciana
  // Garcia" en vez de "Luciana Dulce Garcia Rodríguez"). Exigir igualdad
  // exacta hacía que el aviso "¿eres tú?" casi nunca apareciera para gente
  // que sí ya estaba registrada — el problema que se intentaba evitar.
  //
  // Se exige que TODAS las palabras escritas aparezcan como palabra
  // completa (no como prefijo) en el nombre guardado — no alcanza con
  // escribir solo el nombre de pila (ahí sí habría demasiados falsos
  // positivos con nombres comunes). El match sigue sin autocompletar nada
  // por sí solo: la persona igual tiene que confirmar "Sí, soy yo".
  const possibleMatch = useMemo(() => {
    const inputWords = normalize(`${form.nombre} ${form.apellidos}`)
      .split(' ')
      .filter(Boolean);
    if (inputWords.length < 2 || matchDismissed || matchResolved) return null;
    return (
      publicIndex.find((p) => {
        const storedWords = new Set(normalize(p.nombreCompleto).split(' ').filter(Boolean));
        return inputWords.every((w) => storedWords.has(w));
      }) || null
    );
  }, [publicIndex, form.nombre, form.apellidos, matchDismissed, matchResolved]);

  async function handleConfirmMatch() {
    setConfirmingMatch(true);
    try {
      // El índice público solo trae nombre+estaca (exposición mínima ya
      // acordada) — para autocompletar todo lo demás hace falta el
      // documento completo, que ya se puede leer por ID exacto (mismo
      // permiso que ya existía para el chequeo de duplicados).
      const persona = await fetchPersonaByWhatsapp(possibleMatch.whatsapp);
      if (persona) {
        setForm({
          nombre: persona.nombre || form.nombre,
          apellidos: persona.apellidos || form.apellidos,
          sexo: persona.sexo || form.sexo,
          fechaNacimiento: persona.fechaNacimiento || form.fechaNacimiento,
          estaca: persona.estaca || form.estaca,
          barrio: persona.barrio || form.barrio,
          correo: persona.correo || form.correo,
          whatsapp: possibleMatch.whatsapp,
        });
      } else {
        // Muy raro (el índice y personas se escriben juntos), pero por si
        // acaso el documento ya no existiera, al menos el número no se pierde.
        setForm({ whatsapp: possibleMatch.whatsapp });
      }
      setWhatsappLocked(true);
      setMatchResolved(true);
      touch('whatsapp');
    } finally {
      setConfirmingMatch(false);
    }
  }
  function handleDenyMatch() {
    setMatchDismissed(true);
  }
  // Por si alguien solo estaba probando el formulario y confirmó un match
  // que no era el suyo — vuelve a empezar de cero, con el número editable
  // de nuevo, en vez de quedar atascado con datos de otra persona.
  function handleStartOver() {
    dispatch({ type: 'RESET_FORM' });
    setWhatsappLocked(false);
    setMatchResolved(false);
    setMatchDismissed(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (errorCount > 0) {
      dispatch({ type: 'SUBMIT_ATTEMPT' });
      const firstInvalid = FIELD_ORDER.find((f) => errors[f]);
      if (firstInvalid) refs.current[firstInvalid]?.focus();
      return;
    }
    setSubmitError('');
    setSubmitting(true);
    try {
      // Reintenta solo errores transitorios de red (el mismo criterio que
      // ya usa el resto de la app) — un evento con mucha gente conectada a
      // la misma red es justo el escenario donde una escritura puede
      // fallar por un hipo pasajero. 'permission-denied' y el código de
      // duplicado NO se reintentan — reintentar no arregla ninguno de los
      // dos, y en el caso de duplicado hasta podría generar un mensaje
      // confuso en el segundo intento.
      const TRANSIENT_CODES = ['unavailable', 'deadline-exceeded', 'internal', 'resource-exhausted'];
      let lastErr;
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          await registerParticipant(form, targetActivity.id);
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (attempt === 2 || !TRANSIENT_CODES.includes(err?.code)) break;
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
      }
      if (lastErr) throw lastErr;

      const estaca = form.estaca === 'Otra estaca' ? form.estacaOtra.trim() : form.estaca;
      dispatch({
        type: 'FORM_SUCCESS',
        confirmed: {
          nombreCompleto: `${form.nombre.trim()} ${form.apellidos.trim()}`,
          codigo: `JAS-${form.whatsapp.slice(-4)}`,
          estacaBarrio: `${estaca} · ${form.barrio.trim()}`,
        },
      });
    } catch (err) {
      if (err?.code === DUPLICATE_REGISTRATION_CODE) {
        setServerError(`Ya estás registrado(a) para "${targetActivity.nombre}". No necesitas volver a inscribirte.`);
        touch('whatsapp');
        refs.current.whatsapp?.focus();
      } else {
        console.error('[registration] submit failed:', err);
        // El código real queda visible en el mensaje a propósito — antes
        // decía siempre lo mismo sin importar la causa, lo cual hizo que
        // un bug real (una regla de Firestore desactualizada) pasara
        // varios registros sin que nadie pudiera saber qué estaba pasando
        // hasta revisar la consola del navegador a mano.
        const code = err?.code ? ` (código: ${err.code})` : '';
        setSubmitError(`No pudimos completar tu registro en este momento${code}. Inténtalo otra vez o avisa a recepción.`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const REQUIRED_FIELDS = ['nombre', 'apellidos', 'fechaNacimiento', 'sexo', 'categoria', 'whatsapp', 'estaca', 'barrio', 'privacidad'];
  const filledCount = REQUIRED_FIELDS.filter((f) => !errors[f] && form[f]).length;
  const progreso = Math.round((filledCount / REQUIRED_FIELDS.length) * 100);

  if (activitiesLoading) {
    return <ActivityLoadingCard message="Cargando actividad…" />;
  }
  if (!targetActivity) {
    return (
      <div className="reg-form__loading reg-form__loading--static" role="status">
        {activityIdParam
          ? 'Este enlace ya no corresponde a ninguna actividad disponible.'
          : 'No hay ninguna actividad abierta para inscripción en este momento. Vuelve a revisar más tarde.'}
      </div>
    );
  }

  return (
    <form className="reg-form" onSubmit={handleSubmit} noValidate>
      <div className="reg-form__header">
        <div className="reg-form__logo">
          <img src={logoUrl} alt="Centro JAS Noroeste" />
        </div>
        <div className="reg-form__title">{targetActivity.nombre}</div>
        <div className="reg-form__badge">
          {targetActivity.fecha}
          {targetActivity.lugar ? ` · ${targetActivity.lugar}` : ''}
        </div>
        {targetActivity.anfitrion && <div className="reg-form__host">{targetActivity.anfitrion}</div>}
      </div>

      <div className="reg-form__progress">
        <div className="reg-form__progress-label">
          <span>Tu registro</span>
          <span>{progreso}%</span>
        </div>
        <div className="reg-form__progress-track">
          <div className="reg-form__progress-fill" style={{ width: `${progreso}%` }} />
        </div>
      </div>

      <div className="reg-form__body">
        <p className="reg-form__intro">Completa tus datos para registrarte. Los campos con * son obligatorios.</p>

        <div className="reg-form__section-title">¿Quién eres?</div>

        <div className="reg-form__row">
          <Field id="nombre" label="Nombre" error={showErr('nombre')}>
            {(a) => (
              <input
                {...a}
                ref={(el) => (refs.current.nombre = el)}
                type="text"
                autoComplete="given-name"
                value={form.nombre}
                onChange={(e) => setForm({ nombre: e.target.value })}
                onBlur={() => touch('nombre')}
                placeholder="Ej. María"
              />
            )}
          </Field>

          <Field id="apellidos" label="Apellidos" error={showErr('apellidos')}>
            {(a) => (
              <input
                {...a}
                ref={(el) => (refs.current.apellidos = el)}
                type="text"
                autoComplete="family-name"
                value={form.apellidos}
                onChange={(e) => setForm({ apellidos: e.target.value })}
                onBlur={() => touch('apellidos')}
                placeholder="Ej. Ramírez Torres"
              />
            )}
          </Field>
        </div>

        {possibleMatch && (
          <div className="reg-form__match-hint" role="status">
            <div className="reg-form__match-text">
              👋 Ya vimos a alguien parecido: <strong>{possibleMatch.nombreCompleto}</strong> ({possibleMatch.estaca}). ¿Eres tú?
            </div>
            <div className="reg-form__match-actions">
              <button type="button" className="reg-form__match-yes press" onClick={handleConfirmMatch} disabled={confirmingMatch}>
                {confirmingMatch ? 'Un momento…' : 'Sí, soy yo'}
              </button>
              <button type="button" className="reg-form__match-no press" onClick={handleDenyMatch} disabled={confirmingMatch}>
                No, es otra persona
              </button>
            </div>
          </div>
        )}

        {matchResolved && (
          <div className="reg-form__match-confirmed" role="status">
            <span>✓ Completamos tus datos de tu registro anterior — revísalos y corrige lo que haga falta. Tu WhatsApp queda fijo para no duplicarte.</span>
            <button type="button" className="reg-form__match-restart" onClick={handleStartOver}>
              ¿No eras tú? Empezar de nuevo
            </button>
          </div>
        )}

        <Field id="fechaNacimiento" label="Fecha de nacimiento" error={showErr('fechaNacimiento')}>
          {(a) => (
            <input
              {...a}
              ref={(el) => (refs.current.fechaNacimiento = el)}
              type="date"
              autoComplete="bday"
              value={form.fechaNacimiento}
              onChange={(e) => setForm({ fechaNacimiento: e.target.value })}
              onBlur={() => touch('fechaNacimiento')}
            />
          )}
        </Field>

        <div className="reg-form__row">
          <Field id="sexo" label="Sexo" error={showErr('sexo')}>
            {(a) => (
              <select {...a} ref={(el) => (refs.current.sexo = el)} value={form.sexo} onChange={(e) => setForm({ sexo: e.target.value })} onBlur={() => touch('sexo')}>
                <option value="">Elegir</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            )}
          </Field>
          <Field id="categoria" label="Categoría" error={showErr('categoria')}>
            {(a) => (
              <select {...a} ref={(el) => (refs.current.categoria = el)} value={form.categoria} onChange={(e) => setForm({ categoria: e.target.value })} onBlur={() => touch('categoria')}>
                <option value="">Elegir</option>
                {PUBLIC_CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <hr className="reg-form__divider" />
        <div className="reg-form__section-title">¿Cómo te contactamos?</div>

        <div className="reg-form__row">
          <Field id="whatsapp" label="WhatsApp" error={showErr('whatsapp') || serverError}>
            {(a) => (
              <input
                {...a}
                ref={(el) => (refs.current.whatsapp = el)}
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={whatsappLocked ? maskWhatsapp(form.whatsapp) : form.whatsapp}
                onChange={(e) => !whatsappLocked && setForm({ whatsapp: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                onBlur={() => touch('whatsapp')}
                placeholder="9XXXXXXXX"
                maxLength={9}
                readOnly={whatsappLocked}
                aria-readonly={whatsappLocked}
                title={whatsappLocked ? 'Confirmado con tu registro anterior — toca "Empezar de nuevo" arriba si no eras tú' : undefined}
              />
            )}
          </Field>

          <Field id="correo" label="Correo" optional error={showErr('correo')}>
            {(a) => (
              <input
                {...a}
                ref={(el) => (refs.current.correo = el)}
                type="email"
                autoComplete="email"
                value={form.correo}
                onChange={(e) => setForm({ correo: e.target.value })}
                onBlur={() => touch('correo')}
                placeholder="tucorreo@ejemplo.com"
              />
            )}
          </Field>
        </div>

        <hr className="reg-form__divider" />
        <div className="reg-form__section-title">¿De dónde eres?</div>

        <Field id="estaca" label="Estaca" error={showErr('estaca')}>
          {(a) => (
            <select
              {...a}
              ref={(el) => (refs.current.estaca = el)}
              value={form.estaca}
              onChange={(e) => setForm({ estaca: e.target.value, barrio: '' })}
              onBlur={() => touch('estaca')}
            >
              <option value="">Elegir</option>
              <option value="Ventanilla">Ventanilla</option>
              <option value="Miramar">Miramar</option>
              <option value="Puente Piedra">Puente Piedra</option>
              <option value="Otra estaca">Otra estaca</option>
            </select>
          )}
        </Field>

        {form.estaca === 'Otra estaca' && (
          <Field id="estacaOtra" label="Nombre de tu estaca" error={showErr('estacaOtra')}>
            {(a) => (
              <input
                {...a}
                ref={(el) => (refs.current.estacaOtra = el)}
                type="text"
                value={form.estacaOtra}
                onChange={(e) => setForm({ estacaOtra: e.target.value })}
                onBlur={() => touch('estacaOtra')}
                placeholder="Escribe el nombre"
              />
            )}
          </Field>
        )}

        {showBarrioSelect && (
          <Field id="barrio" label="Barrio / Rama" error={showErr('barrio')}>
            {(a) => (
              <select {...a} ref={(el) => (refs.current.barrio = el)} value={form.barrio} onChange={(e) => setForm({ barrio: e.target.value })} onBlur={() => touch('barrio')}>
                <option value="">Elegir</option>
                {barrioOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        {showBarrioInput && (
          <Field id="barrio" label="Barrio / Rama" error={showErr('barrio')}>
            {(a) => (
              <input
                {...a}
                ref={(el) => (refs.current.barrio = el)}
                type="text"
                value={form.barrio}
                onChange={(e) => setForm({ barrio: e.target.value })}
                onBlur={() => touch('barrio')}
                placeholder="Mín. 3 caracteres"
              />
            )}
          </Field>
        )}

        <hr className="reg-form__divider" />

        <label className={`reg-form__consent${form.privacidad ? ' reg-form__consent--checked' : ''}`}>
          <input
            ref={(el) => (refs.current.privacidad = el)}
            type="checkbox"
            checked={form.privacidad}
            onChange={(e) => setForm({ privacidad: e.target.checked })}
            aria-describedby={showErr('privacidad') ? 'privacidad-error' : undefined}
          />
          <span className="reg-form__consent-text">Acepto el tratamiento de mis datos personales para fines de organización del evento. *</span>
        </label>
        {showErr('privacidad') && (
          <span id="privacidad-error" className="field-error" role="alert">
            {showErr('privacidad')}
          </span>
        )}

        {attempted && errorCount > 0 && (
          <div className="reg-form__error-summary" role="alert">
            <AlertIcon width={18} height={18} />
            <span>
              {errorCount === 1 ? 'Hay 1 campo que necesita tu atención' : `Hay ${errorCount} campos que necesitan tu atención`} — revisa lo marcado en rojo arriba.
            </span>
          </div>
        )}
        {submitError && (
          <div className="field-error" role="alert">
            {submitError}
          </div>
        )}
        <button type="submit" className="reg-form__submit press" disabled={submitting}>
          {submitting ? 'Registrando…' : 'Registrarme'}
        </button>
      </div>
    </form>
  );
}
