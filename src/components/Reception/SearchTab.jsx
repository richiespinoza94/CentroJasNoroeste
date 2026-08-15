import { useMemo } from 'react';
import { useStore } from '../../state/store.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { STATUS_META, CATEGORY_META } from '../../domain/constants.js';
import { recommendTables } from '../../domain/tables.js';
import './SearchTab.css';

export default function SearchTab() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const { participants, tables, search, selectedId } = state;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter((p) => `${p.nombre} ${p.apellidos}`.toLowerCase().includes(q) || p.whatsapp.includes(q));
  }, [participants, search]);

  const selected = participants.find((p) => p.id === selectedId) || null;
  const recs = selected ? recommendTables(selected, tables, participants) : [];
  const tableName = selected?.tableId ? tables.find((t) => t.id === selected.tableId)?.name : '';

  function handleCheckIn(p) {
    dispatch({ type: 'CHECK_IN', id: p.id });
    toast(`${p.nombre} marcado(a) como presente.`);
  }
  function handleAssign(p, tableId, name) {
    dispatch({ type: 'ASSIGN_TABLE', id: p.id, tableId });
    toast(`${p.nombre} asignado(a) a ${name}.`);
  }
  function handleUnassign(p) {
    dispatch({ type: 'UNASSIGN_TABLE', id: p.id });
    toast(`${p.nombre} liberado(a) de su mesa.`);
  }

  return (
    <div className="search-tab">
      <div className="search-tab__list-panel">
        <input
          type="text"
          className="search-tab__input"
          value={search}
          onChange={(e) => dispatch({ type: 'SET_SEARCH', value: e.target.value })}
          placeholder="Buscar por nombre o WhatsApp..."
          aria-label="Buscar por nombre o WhatsApp"
        />
        <div className="search-tab__list">
          {filtered.map((p) => {
            const meta = STATUS_META[p.status];
            return (
              <button
                key={p.id}
                type="button"
                className="search-tab__row press"
                aria-pressed={selectedId === p.id}
                onClick={() => dispatch({ type: 'SELECT_PARTICIPANT', id: p.id })}
              >
                <div>
                  <div className="search-tab__name">
                    {p.nombre} {p.apellidos}
                  </div>
                  <div className="search-tab__meta">
                    {p.estaca} · {p.barrio} · {p.whatsapp}
                  </div>
                </div>
                <span className="badge" style={{ background: meta.bg, color: meta.color }}>
                  {meta.label}
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && <div className="search-tab__empty">Sin resultados.</div>}
        </div>
      </div>

      <div className="search-tab__detail">
        {selected ? (
          <>
            <div className="search-tab__detail-name">
              {selected.nombre} {selected.apellidos}
            </div>
            <div className="search-tab__detail-meta">
              {selected.estaca} · {selected.barrio} · {selected.tipoParticipante} · {CATEGORY_META[selected.categoria]}
            </div>
            <div className="search-tab__detail-meta">WhatsApp: {selected.whatsapp}</div>
            <span
              className="badge"
              style={{ display: 'inline-block', marginTop: 12, background: STATUS_META[selected.status].bg, color: STATUS_META[selected.status].color }}
            >
              {STATUS_META[selected.status].label}
            </span>

            {selected.status === 'pendiente' && (
              <button type="button" className="search-tab__checkin press" onClick={() => handleCheckIn(selected)}>
                Confirmar asistencia
              </button>
            )}

            {selected.status === 'presente' && (
              <div style={{ marginTop: 16 }}>
                <div className="search-tab__recs-title">Mesas recomendadas</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recs.map((r) => (
                    <button key={r.id} type="button" className="search-tab__rec press" onClick={() => handleAssign(selected, r.id, r.name)}>
                      <span className="search-tab__rec-name">{r.name}</span>
                      <span className="search-tab__rec-left">{r.spacesLeft} espacios</span>
                    </button>
                  ))}
                  {recs.length === 0 && <div className="search-tab__norecs">No hay mesas disponibles para esta categoría.</div>}
                </div>
              </div>
            )}

            {selected.status === 'asignado' && (
              <div className="search-tab__table-info">
                <div className="search-tab__meta">Mesa asignada</div>
                <div className="search-tab__table-name">{tableName}</div>
                <button type="button" className="search-tab__change press" onClick={() => handleUnassign(selected)}>
                  Cambiar de mesa
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="search-tab__placeholder">Selecciona una persona de la lista.</div>
        )}
      </div>
    </div>
  );
}
