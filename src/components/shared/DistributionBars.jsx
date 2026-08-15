import './DistributionBars.css';

export default function DistributionBars({ title, rows, color }) {
  return (
    <div className="dist-panel">
      <div className="dist-panel__title">{title}</div>
      <div className="dist-list">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="dist-row__top">
              <span>{r.label}</span>
              <span className="tabular" style={{ fontWeight: 700 }}>
                {r.count}
              </span>
            </div>
            <div className="dist-row__track">
              <div className="dist-row__fill" style={{ width: `${r.pct}%`, background: color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
