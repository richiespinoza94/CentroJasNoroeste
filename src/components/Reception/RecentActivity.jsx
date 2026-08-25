import { useMemo, useState } from 'react';
import { useToast } from '../../hooks/useToast.jsx';
import { revertCheckIn } from '../../firebase/collections.js';
import { getStatusMeta } from '../../domain/constants.js';
import './RecentActivity.css';

const toMillis = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0);

// "Qué pasó recién" at a glance, with a one-tap undo for the mistake that
// actually happens during a rush: checking in the wrong person. Selecting a
// card also opens it in the search detail panel below, for anything that
// needs more than an undo.
export default function RecentActivity({ participants, onSelect }) {
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);

  const recent = useMemo(
    () =>
      [...participants]
        .filter((p) => p.status !== 'pendiente')
        .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt))
        .slice(0, 6),
    [participants]
  );

  if (recent.length === 0) return null;

  async function handleUndo(p) {
    setBusyId(p.id);
    try {
      await revertCheckIn(p.id);
      toast(`${p.nombre}: se deshizo el check-in.`);
    } catch (err) {
      toast(err.message || 'No se pudo deshacer.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="recent-activity">
      <div className="recent-activity__title">Actividad reciente</div>
      <div className="recent-activity__row">
        {recent.map((p) => {
          const meta = getStatusMeta(p.status);
          return (
          <div key={p.id} className="recent-activity__card">
            <button type="button" className="recent-activity__select press" onClick={() => onSelect(p.id)}>
              <div className="recent-activity__name">
                {p.nombre} {p.apellidos}
              </div>
              <span className="badge" style={{ background: meta.bg, color: meta.color }}>
                {meta.label}
              </span>
            </button>
            <button type="button" className="recent-activity__undo press" disabled={busyId === p.id} onClick={() => handleUndo(p)}>
              Deshacer
            </button>
          </div>
          );
        })}
      </div>
    </div>
  );
}
