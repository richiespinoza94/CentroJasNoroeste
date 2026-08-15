import { useStore } from '../../state/store.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { occupancyByTable } from '../../domain/tables.js';
import { TrashIcon } from '../ui/Icon.jsx';
import './TablesConfig.css';

export default function TablesConfig() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const { tables, participants } = state;
  const occByTable = occupancyByTable(participants);

  function handleRemove(t) {
    if (!window.confirm(`¿Eliminar "${t.name}"? Esta acción no se puede deshacer.`)) return;
    dispatch({ type: 'REMOVE_TABLE', id: t.id });
    toast(`${t.name} eliminada.`);
  }

  function handleAdd() {
    dispatch({ type: 'ADD_TABLE' });
    toast(`Mesa ${state.nextTableId} creada.`);
  }

  return (
    <div className="admin__panel">
      <div className="admin__panel-head">
        <div className="admin__panel-title">Configuración de mesas</div>
        <button type="button" className="admin__add-btn press" onClick={handleAdd}>
          + Agregar mesa
        </button>
      </div>

      <div>
        {tables.map((t) => {
          const occ = occByTable[t.id] || 0;
          const canDelete = occ === 0;
          return (
            <div className="tables-config__row" key={t.id}>
              <span className="tables-config__name">{t.name}</span>

              <div className="tables-config__field tables-config__field-cap">
                <label className="tables-config__field-label" htmlFor={`cap-${t.id}`}>
                  Capacidad
                </label>
                <input
                  id={`cap-${t.id}`}
                  type="number"
                  min="1"
                  value={t.capacity}
                  onChange={(e) => dispatch({ type: 'SET_TABLE_CAPACITY', id: t.id, value: e.target.value })}
                />
              </div>

              <div className="tables-config__field tables-config__field-res">
                <label className="tables-config__field-label" htmlFor={`res-${t.id}`}>
                  Reservada para
                </label>
                <select id={`res-${t.id}`} value={t.reservedFor || ''} onChange={(e) => dispatch({ type: 'SET_TABLE_RESERVED', id: t.id, value: e.target.value })}>
                  <option value="">General (todos)</option>
                  <option value="staff">Solo staff</option>
                  <option value="programa">Solo programa</option>
                  <option value="invitado">Solo invitados</option>
                </select>
              </div>

              <span className="tables-config__occ tabular">{occ} ocup.</span>

              {canDelete && (
                <button type="button" className="tables-config__delete press" onClick={() => handleRemove(t)} aria-label={`Eliminar ${t.name}`}>
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
