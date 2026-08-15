import { useCallback } from 'react';
import { useChangedIds } from '../../hooks/useChangedIds.js';
import './StatCards.css';

export default function StatCards({ cards }) {
  const withId = cards.map((s) => ({ id: s.label, ...s }));
  const getValue = useCallback((s) => s.value, []);
  const justChanged = useChangedIds(withId, getValue);

  return (
    <div className="stat-grid">
      {withId.map((s) => (
        <div className={`stat-card${justChanged.has(s.id) ? ' stat-card--updated' : ''}`} key={s.label}>
          <div className="stat-card__label">{s.label}</div>
          <div className="stat-card__value tabular">{s.value}</div>
        </div>
      ))}
    </div>
  );
}
