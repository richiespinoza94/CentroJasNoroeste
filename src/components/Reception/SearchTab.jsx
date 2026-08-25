import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store.jsx';
import { useFirestoreData } from '../../firebase/DataProvider.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { getStatusMeta, CATEGORIAS } from '../../domain/constants.js';
import { checkIn, revertCheckIn, setCategoria } from '../../firebase/collections.js';
import RecentActivity from './RecentActivity.jsx';
import './SearchTab.css';

export default function SearchTab() {
  const { state, dispatch } = useStore();
  const { participants } = useFirestoreData();
  const toast = useToast();
  const { search, selectedId } = state;
  const [busy, setBusy] = useState(false);
  const detailRef = useRef(null);

  // En mobile, lista y detalle quedan apilados (el detalle cae debajo de
  // toda la lista). Sin este scroll, tocar a alguien no muestra ningún
  // cambio visible en pantalla — el detalle aparece fuera del viewport.
  useEffect(() => {
    if (selectedId) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter((p) => `${p.nombre} ${p.apellidos}`.toLowerCase().includes(q) || p.whatsapp.includes(q));
  }, [participants, search]);

  const selected = participants.find((p) => p.id === selectedId) || null;

  async function handleCheckIn(p) {
    setBusy(true);
    try {
      await checkIn(p.id);
      toast(`${p.nombre} marcado(a) como presente.`);
    } catch (err) {
      toast(err.message || 'No se pudo confirmar asistencia.', 'error');
    } finally {
      setBusy(false);
    }
  }
  async function handleRevertCheckIn(p) {
    setBusy(true);
    try {
      await revertCheckIn(p.id);
      toast(`${p.nombre}: check-in deshecho, vuelve a "pendiente".`);
    } catch (err) {
      toast(err.message || 'No se pudo deshacer.', 'error');
    } finally {
      setBusy(false);
    }
  }
  async function handleSetCategoria(p, categoria) {
    if (categoria === p.categoria) return;
    setBusy(true);
    try {
      await setCategoria(p.id, categoria);
      toast(`${p.nombre}: categoría cambiada a ${categoria}.`);
    } catch (err) {
      toast(err.message || 'No se pudo cambiar la categoría.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="search-tab">
      <div className="search-tab__list-panel">
        <RecentActivity participants={participants} onSelect={(id) => dispatch({ type: 'SELECT_PARTICIPANT', id })} />
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
            const meta = getStatusMeta(p.status);
            return (
              <button
                key={p.id}
                type="button"
                className="search-tab__row press"
                aria-pressed={selectedId === p.id}
                onClick={() => dispatch({ type: 'SELECT_PARTICIPANT', id: p.id })}
              >
                <div className="search-tab__row-info">
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

      <div className="search-tab__detail" ref={detailRef}>
        {selected ? (() => {
          const selectedMeta = getStatusMeta(selected.status);
          return (
          <>
            <div className="search-tab__detail-name">
              {selected.nombre} {selected.apellidos}
            </div>
            <div className="search-tab__detail-meta">
              {selected.estaca} · {selected.barrio}
            </div>
            <div className="search-tab__detail-meta">WhatsApp: {selected.whatsapp}</div>
            <div className="search-tab__categoria-row">
              <span className="search-tab__categoria-label">Categoría</span>
              <select
                className="search-tab__categoria-select"
                value={selected.categoria}
                disabled={busy}
                onChange={(e) => handleSetCategoria(selected, e.target.value)}
                aria-label="Cambiar categoría"
              >
                {!CATEGORIAS.includes(selected.categoria) && (
                  <option value={selected.categoria}>{selected.categoria} (valor antiguo)</option>
                )}
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <span
              className="badge"
              style={{ display: 'inline-block', marginTop: 12, background: selectedMeta.bg, color: selectedMeta.color }}
            >
              {selectedMeta.label}
            </span>

            {selected.status === 'pendiente' && (
              <button type="button" className="search-tab__checkin press" disabled={busy} onClick={() => handleCheckIn(selected)}>
                Confirmar asistencia
              </button>
            )}

            {selected.status === 'presente' && (
              <button type="button" className="search-tab__change press" style={{ marginTop: 16 }} disabled={busy} onClick={() => handleRevertCheckIn(selected)}>
                Deshacer check-in
              </button>
            )}
          </>
          );
        })() : (
          <div className="search-tab__placeholder">Selecciona una persona de la lista.</div>
        )}
      </div>
    </div>
  );
}
