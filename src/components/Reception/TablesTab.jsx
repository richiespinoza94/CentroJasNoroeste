import { useStore } from '../../state/store.jsx';
import { computeTableCards } from '../../domain/stats.js';
import './TablesTab.css';

export default function TablesTab() {
  const { state } = useStore();
  const cards = computeTableCards(state.participants, state.tables);

  return (
    <div className="tables-grid">
      {cards.map((t) => (
        <div className="table-card" key={t.id} style={{ borderTopColor: t.accentColor }}>
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
