import { useState } from 'react';
import { useStore } from '../../state/store.jsx';
import { useFirestoreData } from '../../firebase/DataProvider.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { validateManual } from '../../domain/validation.js';
import { registerManual } from '../../firebase/collections.js';
import Field from '../ui/Field.jsx';
import './ManualTab.css';

// Reception's fallback for people without a phone / QR trouble (PRD §8).
// Kept as its own screen since the fields and audit intent differ from
// self-service registration (no privacy checkbox, defaults to "presente").
export default function ManualTab() {
  const { state, dispatch } = useStore();
  const { participants } = useFirestoreData();
  const toast = useToast();
  const { manual, manualError, manualSuccess } = state;
  const [submitting, setSubmitting] = useState(false);

  const setManual = (patch) => dispatch({ type: 'SET_MANUAL', patch });

  async function handleSubmit(e) {
    e.preventDefault();
    const error = validateManual(manual, participants);
    if (error) {
      dispatch({ type: 'MANUAL_ERROR', error });
      return;
    }
    setSubmitting(true);
    try {
      await registerManual(manual);
      const message = `${manual.nombre.trim()} registrado(a) y presente.`;
      dispatch({ type: 'MANUAL_SUCCESS', message });
      toast(message);
    } catch (err) {
      dispatch({ type: 'MANUAL_ERROR', error: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="manual-tab" onSubmit={handleSubmit}>
      <div className="manual-tab__title">Registro manual</div>

      <Field id="manualNombre" label="Nombre">
        {(a) => <input {...a} type="text" value={manual.nombre} onChange={(e) => setManual({ nombre: e.target.value })} placeholder="Nombre" />}
      </Field>
      <Field id="manualApellidos" label="Apellidos">
        {(a) => <input {...a} type="text" value={manual.apellidos} onChange={(e) => setManual({ apellidos: e.target.value })} placeholder="Apellidos" />}
      </Field>
      <Field id="manualWhatsapp" label="WhatsApp">
        {(a) => (
          <input
            {...a}
            type="tel"
            inputMode="numeric"
            value={manual.whatsapp}
            onChange={(e) => setManual({ whatsapp: e.target.value.replace(/\D/g, '').slice(0, 9) })}
            placeholder="9XXXXXXXX"
            maxLength={9}
          />
        )}
      </Field>
      <Field id="manualEstaca" label="Estaca">
        {(a) => (
          <select {...a} value={manual.estaca} onChange={(e) => setManual({ estaca: e.target.value })}>
            <option value="">Estaca</option>
            <option value="Ventanilla">Ventanilla</option>
            <option value="Miramar">Miramar</option>
            <option value="Puente Piedra">Puente Piedra</option>
            <option value="Otra estaca">Otra estaca</option>
          </select>
        )}
      </Field>
      <Field id="manualBarrio" label="Barrio / Rama">
        {(a) => <input {...a} type="text" value={manual.barrio} onChange={(e) => setManual({ barrio: e.target.value })} placeholder="Barrio / Rama" />}
      </Field>
      <Field id="manualCategoria" label="Categoría">
        {(a) => (
          <select {...a} value={manual.categoria} onChange={(e) => setManual({ categoria: e.target.value })}>
            <option value="participante">Participante</option>
            <option value="programa">Programa</option>
            <option value="staff">Staff</option>
          </select>
        )}
      </Field>

      {manualError && (
        <span className="field-error" role="alert">
          {manualError}
        </span>
      )}
      {manualSuccess && <span className="manual-tab__success">{manualSuccess}</span>}

      <button type="submit" className="manual-tab__submit press" disabled={submitting}>
        {submitting ? 'Registrando…' : 'Registrar y marcar presente'}
      </button>
    </form>
  );
}
