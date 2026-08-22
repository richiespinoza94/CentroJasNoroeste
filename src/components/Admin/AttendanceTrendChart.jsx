import './AttendanceTrendChart.css';

const WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 34;
const PAD_RIGHT = 16;
const PAD_TOP = 28;
const PAD_BOTTOM = 36;

function buildPath(points) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

/**
 * Línea de tendencia de asistencia entre actividades. Sin librería de
 * charts a propósito (ponytail) — son 1-2 series y unos pocos puntos, un
 * SVG simple alcanza y sobra. Sigue las guías de ux-ui-pro-max que aplican
 * a este caso: etiquetas directas en vez de depender solo de ejes, tooltip
 * nativo por punto, estado vacío explícito, resumen accesible para lectores
 * de pantalla, líneas de grilla de bajo contraste.
 */
export default function AttendanceTrendChart({ data }) {
  if (data.length < 2) {
    return (
      <div className="trend-chart trend-chart--empty">
        <div className="trend-chart__title">Tendencia de asistencia</div>
        <div className="trend-chart__empty-msg">Necesitas al menos 2 actividades con historial para ver una tendencia.</div>
      </div>
    );
  }

  const maxVal = Math.max(1, ...data.map((d) => d.registrados));
  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;
  const yFor = (v) => PAD_TOP + plotH - (v / maxVal) * plotH;

  const registradosPts = data.map((d, i) => ({ x: PAD_LEFT + i * stepX, y: yFor(d.registrados), v: d.registrados, label: d.label, fecha: d.fecha }));
  const presentesPts = data.map((d, i) => ({ x: PAD_LEFT + i * stepX, y: yFor(d.presentes), v: d.presentes, label: d.label, fecha: d.fecha }));

  const first = data[0].presentes;
  const last = data[data.length - 1].presentes;
  const trendWord = last > first ? 'subiendo' : last < first ? 'bajando' : 'estable';
  const gridLines = [0, 0.5, 1].map((f) => PAD_TOP + plotH * f);

  return (
    <div className="trend-chart">
      <div className="trend-chart__title">Tendencia de asistencia</div>
      <div className="trend-chart__legend">
        <span className="trend-chart__legend-item">
          <i className="trend-chart__dot trend-chart__dot--gold" /> Registrados
        </span>
        <span className="trend-chart__legend-item">
          <i className="trend-chart__dot trend-chart__dot--navy" /> Asistieron
        </span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="trend-chart__svg"
        role="img"
        aria-label={`Asistencia ${trendWord}: de ${first} personas en "${data[0].label}" a ${last} en "${data[data.length - 1].label}".`}
      >
        {gridLines.map((y) => (
          <line key={y} x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y} y2={y} className="trend-chart__grid" />
        ))}

        <path d={buildPath(registradosPts)} className="trend-chart__line trend-chart__line--gold" />
        <path d={buildPath(presentesPts)} className="trend-chart__line trend-chart__line--navy" />

        {presentesPts.map((p, i) => (
          <g key={i}>
            <circle cx={registradosPts[i].x} cy={registradosPts[i].y} r="3.5" className="trend-chart__point trend-chart__point--gold" />
            <circle cx={p.x} cy={p.y} r="3.5" className="trend-chart__point trend-chart__point--navy" />
            {/* Área táctil ampliada e invisible — el punto visible es chico, pero el objetivo de toque no debe serlo. */}
            <circle cx={p.x} cy={p.y} r="18" className="trend-chart__hit">
              <title>
                {p.label} ({p.fecha}): {registradosPts[i].v} registrados, {p.v} asistieron
              </title>
            </circle>
            <text x={p.x} y={p.y - 10} textAnchor="middle" className="trend-chart__value-label">
              {p.v}
            </text>
            <text x={p.x} y={HEIGHT - PAD_BOTTOM + 16} textAnchor="middle" className="trend-chart__x-label">
              {p.fecha?.slice(0, 5) || ''}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
