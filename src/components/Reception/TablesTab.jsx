import { useCallback } from 'react';
import { useFirestoreData } from '../../firebase/DataProvider.jsx';
import { computeTableCards } from '../../domain/stats.js';
import { useChangedIds } from '../../hooks/useChangedIds.js';
import './TablesTab.css';

export default function TablesTab() {
  const { tables } = useFirestoreData();
  const cards = computeTableCards(tables);
  const getOcc = useCallback((t) => t.occ, []);
  const justChanged = useChangedIds(cards, getOcc);

  return (
    <div className="tables-grid">
      {cards.map((t) => (
        <div className={`table-card${justChanged.has(t.id) ? ' table-card--updated' : ''}`} key={t.id} style={{ borderTopColor: t.accentColor }}>
          <div className="table-card__name">{t.name}</div>
          <div className="table-card__ratio tabular">
            {t.occ}/{t.capacity}
          </div>
          <div className="table-card__track">
            <div className="table-card__fill" style={{ width: `${t.pct}%`, background: t.accentColor }} />
          </div>
          <div className="table-card__status" style={{ color: t.statusColor }}>
            {t.statusLabel}
          </div>
        </div>
      ))}
    </div>
  );
}
