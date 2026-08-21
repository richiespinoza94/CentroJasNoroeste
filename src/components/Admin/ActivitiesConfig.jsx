import { useState } from 'react';
import { useToast } from '../../hooks/useToast.jsx';
import { createActivity, updateActivity, setActiveActivity } from '../../firebase/collections.js';
import Field from '../ui/Field.jsx';
import './ActivitiesConfig.css';

const EMPTY = { nombre: '', fecha: '', lugar: '', anfitrion: 'Centro JAS Noroeste' };

export default function ActivitiesConfig({ activities }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);

  const setField = (patch) => setForm((f) => ({ ...f, ...patch }));

  function startEdit(a) {
    setEditingId(a.id);
    setForm({ nombre: a.nombre, fecha: a.fecha, lugar: a.lugar || '', anfitrion: a.anfitrion || '' });
  }
  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nombre.trim() || !form.fecha.trim()) {
      toast('Nombre y fecha son obligatorios.', 'error');
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await updateActivity(editingId, form);
        toast('Actividad actualizada.');
      } else {
        await createActivity(form);
        toast('Actividad creada. Actívala cuando esté lista.');
      }
      cancelEdit();
    } catch (err) {
      toast(err.message || 'No se pudo guardar.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleActivate(a) {
    if (a.activa) return;
    setBusy(true);
    try {
      await setActiveActivity(a.id, activities);
      toast(`"${a.nombre}" es ahora la actividad activa.`);
    } catch (err) {
      toast(err.message || 'No se pudo activar.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="activities-config">
      <form className="activities-config__form" onSubmit={handleSubmit}>
        <div className="activities-config__form-title">{editingId ? 'Editar actividad' : 'Nueva actividad'}</div>

        <Field id="actNombre" label="Nombre">
          {(a) => <input {...a} type="text" value={form.nombre} onChange={(e) => setField({ nombre: e.target.value })} placeholder="Ej. Full Day Centro JAS Noroeste" />}
        </Field>
        <Field id="actFecha" label="Fecha">
          {(a) => <input {...a} type="text" value={form.fecha} onChange={(e) => setField({ fecha: e.target.value })} placeholder="Ej. 29/06/2026" />}
        </Field>
        <Field id="actLugar" label="Lugar" optional>
          {(a) => <input {...a} type="text" value={form.lugar} onChange={(e) => setField({ lugar: e.target.value })} placeholder="Ej. Local Estaca Ventanilla" />}
        </Field>
        <Field id="actAnfitrion" label="Anfitrión" optional>
          {(a) => <input {...a} type="text" value={form.anfitrion} onChange={(e) => setField({ anfitrion: e.target.value })} />}
        </Field>

        <div className="activities-config__form-actions">
          <button type="submit" className="activities-config__save press" disabled={busy}>
            {editingId ? 'Guardar cambios' : 'Crear actividad'}
          </button>
          {editingId && (
            <button type="button" className="activities-config__cancel press" onClick={cancelEdit} disabled={busy}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="activities-config__list">
        {activities.length === 0 && <div className="activities-config__empty">Todavía no hay actividades creadas.</div>}
        {activities.map((a) => (
          <div key={a.id} className={`activities-config__row${a.activa ? ' activities-config__row--active' : ''}`}>
            <div className="activities-config__row-info">
              <div className="activities-config__row-name">
                {a.nombre}
                {a.activa && <span className="activities-config__badge">Activa</span>}
              </div>
              <div className="activities-config__row-meta">
                {a.fecha}
                {a.lugar ? ` · ${a.lugar}` : ''}
              </div>
            </div>
            <div className="activities-config__row-actions">
              <button type="button" className="activities-config__edit press" disabled={busy} onClick={() => startEdit(a)}>
                Editar
              </button>
              {!a.activa && (
                <button type="button" className="activities-config__activate press" disabled={busy} onClick={() => handleActivate(a)}>
                  Activar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
