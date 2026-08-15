import { useState } from 'react';
import { useToast } from '../../hooks/useToast.jsx';
import { addTable, removeTable, setTableCapacity, setTableReserved } from '../../firebase/collections.js';
import { TrashIcon } from '../ui/Icon.jsx';
import './TablesConfig.css';

export default function TablesConfig({ tables }) {
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);
  const [adding, setAdding] = useState(false);

  async function handleRemove(t) {
    if (!window.confirm(`¿Eliminar "${t.name}"? Esta acción no se puede deshacer.`)) return;
    setBusyId(t.id);
    try {
      await removeTable(t.id);
      toast(`${t.name} eliminada.`);
    } catch (err) {
      toast(err.message || 'No se pudo eliminar la mesa.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdd() {
    setAdding(true);
    try {
      await addTable(tables);
      toast('Mesa creada.');
    } catch (err) {
      toast(err.message || 'No se pudo crear la mesa.', 'error');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="admin__panel">
      <div className="admin__panel-head">
        <div className="admin__panel-title">Configuración de mesas</div>
        <button type="button" className="admin__add-btn press" disabled={adding} onClick={handleAdd}>
          + Agregar mesa
        </button>
      </div>

      <div>
        {tables.map((t) => {
          const occ = t.occ || 0;
          const canDelete = occ === 0;
          return (
            <div className="tables-config__row" key={t.id}>
              <span className="tables-config__name">{t.name}</span>

              <div className="tables-config__field tables-config__field-cap">
                <label className="tables-config__field-label" htmlFor={`cap-${t.id}`}>
                  Capacidad
                </label>
                <input
                  key={t.capacity}
                  id={`cap-${t.id}`}
                  type="number"
                  min="1"
                  defaultValue={t.capacity}
                  onBlur={(e) => setTableCapacity(t.id, e.target.value)}
                />
              </div>

              <div className="tables-config__field tables-config__field-res">
                <label className="tables-config__field-label" htmlFor={`res-${t.id}`}>
                  Reservada para
                </label>
                <select id={`res-${t.id}`} value={t.reservedFor || ''} onChange={(e) => setTableReserved(t.id, e.target.value)}>
                  <option value="">General (todos)</option>
                  <option value="staff">Solo staff</option>
                  <option value="programa">Solo programa</option>
                  <option value="invitado">Solo invitados</option>
                </select>
              </div>

              <span className="tables-config__occ tabular">{occ} ocup.</span>

              {canDelete && (
                <button type="button" className="tables-config__delete press" disabled={busyId === t.id} onClick={() => handleRemove(t)} aria-label={`Eliminar ${t.name}`}>
                  <TrashIcon width={18} height={18} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="admin__hint">Una mesa "reservada" no aparece como opción al asignar mesa a personas de otra categoría.</div>
    </div>
  );
}
