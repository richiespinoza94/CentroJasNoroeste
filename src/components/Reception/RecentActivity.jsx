import { useMemo, useState } from 'react';
import { useToast } from '../../hooks/useToast.jsx';
import { unassignTable, revertCheckIn } from '../../firebase/collections.js';
import { STATUS_META } from '../../domain/constants.js';
import './RecentActivity.css';

const toMillis = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0);

// "Qué pasó recién" at a glance, with a one-tap undo for the two mistakes
// that actually happen during a rush: checking in the wrong person, or
// assigning the wrong table. Selecting a card also opens it in the search
// detail panel below, for anything that needs more than an undo.
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

  async function handleUndo(p, e) {
    e.stopPropagation();
    setBusyId(p.id);
    try {
      if (p.status === 'asignado') {
        await unassignTable(p.id);
        toast(`${p.nombre}: se deshizo la asignación de mesa.`);
      } else if (p.status === 'presente') {
        await revertCheckIn(p.id);
        toast(`${p.nombre}: se deshizo el check-in.`);
      }
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
        {recent.map((p) => (
          <div key={p.id} className="recent-activity__card press" onClick={() => onSelect(p.id)} role="button" tabIndex={0}>
            <div>
              <div className="recent-activity__name">
                {p.nombre} {p.apellidos}
              </div>
              <span className="badge" style={{ background: STATUS_META[p.status].bg, color: STATUS_META[p.status].color }}>
                {STATUS_META[p.status].label}
              </span>
            </div>
            <button type="button" className="recent-activity__undo" disabled={busyId === p.id} onClick={(e) => handleUndo(p, e)}>
              Deshacer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
