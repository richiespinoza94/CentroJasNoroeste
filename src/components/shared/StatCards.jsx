import './StatCards.css';

export default function StatCards({ cards }) {
  return (
    <div className="stat-grid">
      {cards.map((s) => (
        <div className="stat-card" key={s.label}>
          <div className="stat-card__label">{s.label}</div>
          <div className="stat-card__value tabular">{s.value}</div>
        </div>
      ))}
    </div>
  );
}
