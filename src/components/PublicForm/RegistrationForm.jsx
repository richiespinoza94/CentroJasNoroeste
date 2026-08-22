import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store.jsx';
import { useFirestoreData } from '../../firebase/DataProvider.jsx';
import { ESTACAS, PUBLIC_CATEGORIAS } from '../../domain/constants.js';
import { validateRegistration } from '../../domain/validation.js';
import { registerParticipant, subscribePublicIndex } from '../../firebase/collections.js';
import logoUrl from '../../assets/logo.png';
import Field from '../ui/Field.jsx';
import './RegistrationForm.css';

const FIELD_ORDER = ['nombre', 'apellidos', 'fechaNacimiento', 'sexo', 'categoria', 'whatsapp', 'estaca', 'estacaOtra', 'barrio', 'correo', 'privacidad'];

// Normaliza acentos/mayúsculas — mismo patrón usado en el buscador de
// Admin → Personas y en el checkin.html del Full Day.
function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function RegistrationForm() {
  const { state, dispatch } = useStore();
  const { activeActivity, activitiesLoading } = useFirestoreData();
  const { form, touched, attempted } = state;
  const refs = useRef({});
  const [submitting, setSubmitting] = useState(false);
  // "Ya existe un registro" can only be known once Firestore rejects the
  // write — the public form has no read access to the participant list
  // (by design, see firestore.rules), so this can't be a live field check
  // the way the other validations are.
  const [serverError, setServerError] = useState('');

  // Índice público mínimo (nombre + estaca, ver collections.js) para avisar
  // "ya vimos a alguien parecido" — nunca autocompleta, nunca bloquea.
  const [publicIndex, setPublicIndex] = useState([]);
  const [matchDismissed, setMatchDismissed] = useState(false);
  useEffect(() => {
    subscribePublicIndex().then(setPublicIndex);
  }, []);

  const errors = useMemo(() => validateRegistration(form, []), [form]);
  const showErr = (field) => ((attempted || touched[field]) ? errors[field] : undefined);

  const setForm = (patch) => {
    if (patch.whatsapp !== undefined) setServerError('');
    dispatch({ type: 'SET_FORM', patch });
  };
  const touch = (field) => dispatch({ type: 'TOUCH_FIELD', field });

  const barrioOptions = ESTACAS[form.estaca] || [];
  const showBarrioSelect = !!form.estaca && form.estaca !== 'Otra estaca';
  const showBarrioInput = form.estaca === 'Otra estaca';

  // Solo avisa con coincidencia fuerte (nombre completo casi exacto) — el
  // objetivo es evitar duplicar identidad, no generar ruido con nombres
  // comunes a medio escribir.
  const possibleMatch = useMemo(() => {
    const nombreCompleto = normalize(`${form.nombre} ${form.apellidos}`);
    if (nombreCompleto.length < 6 || matchDismissed) return null;
    return publicIndex.find((p) => normalize(p.nombreCompleto) === nombreCompleto) || null;
  }, [publicIndex, form.nombre, form.apellidos, matchDismissed]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (Object.keys(errors).length > 0) {
      dispatch({ type: 'SUBMIT_ATTEMPT' });
      const firstInvalid = FIELD_ORDER.find((f) => errors[f]);
      if (firstInvalid) refs.current[firstInvalid]?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await registerParticipant(form, activeActivity.id);
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
      setServerError(err.message);
      touch('whatsapp');
      refs.current.whatsapp?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  const REQUIRED_FIELDS = ['nombre', 'apellidos', 'fechaNacimiento', 'sexo', 'categoria', 'whatsapp', 'estaca', 'barrio', 'privacidad'];
  const filledCount = REQUIRED_FIELDS.filter((f) => !errors[f] && form[f]).length;
  const progreso = Math.round((filledCount / REQUIRED_FIELDS.length) * 100);

  if (activitiesLoading) {
    return <div className="reg-form__loading">Cargando actividad…</div>;
  }
  if (!activeActivity) {
    return (
      <div className="reg-form__loading">
        No hay ninguna actividad abierta para inscripción en este momento. Vuelve a revisar más tarde.
      </div>
    );
  }

  return (
    <form className="reg-form" onSubmit={handleSubmit} noValidate>
      <div className="reg-form__header">
        <div className="reg-form__logo">
          <img src={logoUrl} alt="Centro JAS Noroeste" />
        </div>
        <div className="reg-form__title">{activeActivity.nombre}</div>
        <div className="reg-form__badge">
          {activeActivity.fecha}
          {activeActivity.lugar ? ` · ${activeActivity.lugar}` : ''}
        </div>
        {activeActivity.anfitrion && <div className="reg-form__host">{activeActivity.anfitrion}</div>}
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
            <span>
              👋 Ya vimos a alguien parecido: <strong>{possibleMatch.nombreCompleto}</strong> ({possibleMatch.estaca}). Si eres tú y ya te registraste en otra
              actividad, usa el mismo número de WhatsApp de esa vez para no duplicar tu registro.
            </span>
            <button type="button" className="reg-form__match-dismiss" onClick={() => setMatchDismissed(true)} aria-label="Cerrar aviso">
              ✕
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
                value={form.whatsapp}
                onChange={(e) => setForm({ whatsapp: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                onBlur={() => touch('whatsapp')}
                placeholder="9XXXXXXXX"
                maxLength={9}
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

        <button type="submit" className="reg-form__submit press" disabled={submitting}>
          {submitting ? 'Registrando…' : 'Registrarme'}
        </button>
      </div>
    </form>
  );
}
