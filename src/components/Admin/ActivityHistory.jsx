import { useEffect, useMemo, useState } from 'react';
import { fetchAllInscripciones } from '../../firebase/collections.js';
import { CATEGORIAS, STATUS_META } from '../../domain/constants.js';
import StatCards from '../shared/StatCards.jsx';
import AttendanceTrendChart from './AttendanceTrendChart.jsx';
import './ActivityHistory.css';

const CATEGORIA_PLURAL = { Miembro: 'Miembros', Invitado: 'Invitados', Líder: 'Líderes', Staff: 'Staff' };

// AdminScreen desmonta cada pestaña al cambiar ({tab === X && <Comp/>}), así
// que sin esta caché a nivel de módulo, entrar y salir de Historial repetía
// la lectura completa de `inscripciones` cada vez — aunque no hubiera
// cambiado nada. Vive fuera del componente a propósito, para sobrevivir a
// los remounts; se invalida solo cuando el staff toca "Actualizar".
let cachedInscripciones = null;

// Las actividades guardan la fecha como texto libre ("15/08/2026") — esto
// la vuelve ordenable sin forzar un <input type="date"> en el formulario
// de Actividades, que ya funciona bien como texto simple.
function parseFecha(fecha) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(fecha || '');
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
}

export default function ActivityHistory({ activities, personas }) {
  const [inscripciones, setInscripciones] = useState(cachedInscripciones); // null solo si nunca se cargó
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (cachedInscripciones) return; // ya hay datos en caché — no repetir la lectura
    fetchAllInscripciones().then((rows) => {
      cachedInscripciones = rows;
      setInscripciones(rows);
    });
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const rows = await fetchAllInscripciones();
      cachedInscripciones = rows;
      setInscripciones(rows);
    } finally {
      setRefreshing(false);
    }
  }

  const byActivity = useMemo(() => {
    const map = new Map();
    if (!inscripciones) return map;
    const personaMap = new Map(personas.map((p) => [p.id, p]));
    for (const i of inscripciones) {
      const persona = personaMap.get(i.whatsapp);
      if (!persona) continue; // inscripción huérfana — se ignora en vez de romper la vista
      const row = { ...persona, id: i.id, whatsapp: persona.id, categoria: i.categoria, status: i.status };
      if (!map.has(i.activityId)) map.set(i.activityId, []);
      map.get(i.activityId).push(row);
    }
    return map;
  }, [inscripciones, personas]);

  const sortedActivities = useMemo(() => [...activities].sort((a, b) => (parseFecha(a.fecha) || 0) - (parseFecha(b.fecha) || 0)), [activities]);

  const selected = sortedActivities.find((a) => a.id === selectedId) || sortedActivities[sortedActivities.length - 1] || null;
  const selectedAttendees = selected ? byActivity.get(selected.id) || [] : [];

  const trendData = useMemo(
    () =>
      sortedActivities.map((a) => {
        const rows = byActivity.get(a.id) || [];
        return { label: a.nombre, fecha: a.fecha, registrados: rows.length, presentes: rows.filter((r) => r.status !== 'pendiente').length };
      }),
    [sortedActivities, byActivity]
  );

  async function handleDownload() {
    if (!selected || selectedAttendees.length === 0) return;
    const { downloadParticipantsReport } = await import('../../domain/report.js');
    downloadParticipantsReport(selectedAttendees, selected.nombre);
  }

  if (inscripciones === null) {
    return <div className="activity-history__loading">Cargando historial…</div>;
  }
  if (sortedActivities.length === 0) {
    return <div className="activity-history__loading">Todavía no hay actividades creadas.</div>;
  }

  const cards = selected
    ? [
        { label: 'Total registrados', value: selectedAttendees.length },
        { label: 'Asistieron', value: selectedAttendees.filter((p) => p.status !== 'pendiente').length },
        { label: 'Pendientes', value: selectedAttendees.filter((p) => p.status === 'pendiente').length },
        ...CATEGORIAS.map((c) => ({ label: CATEGORIA_PLURAL[c], value: selectedAttendees.filter((p) => p.categoria === c).length })),
      ]
    : [];

  return (
    <div className="activity-history">
      <AttendanceTrendChart data={trendData} />

      <div className="activity-history__toolbar">
        <div className="activity-history__selector" role="tablist" aria-label="Elegir actividad">
          {sortedActivities.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={selected?.id === a.id}
              className={`activity-history__chip press${selected?.id === a.id ? ' activity-history__chip--active' : ''}`}
              onClick={() => setSelectedId(a.id)}
            >
              {a.nombre}
            </button>
          ))}
        </div>
        <button type="button" className="activity-history__refresh press" disabled={refreshing} onClick={handleRefresh} aria-label="Actualizar historial">
          {refreshing ? '…' : '↻'}
        </button>
      </div>

      {selected && (
        <>
          <div className="activity-history__detail-title">
            {selected.nombre}
            <span className="activity-history__detail-meta">
              {selected.fecha}
              {selected.lugar ? ` · ${selected.lugar}` : ''}
            </span>
          </div>

          <StatCards cards={cards} />

          <button type="button" className="activity-history__download press" disabled={selectedAttendees.length === 0} onClick={handleDownload}>
            Descargar reporte (Excel)
          </button>

          <div className="activity-history__list">
            {selectedAttendees.map((p) => {
              const meta = STATUS_META[p.status] || STATUS_META.pendiente;
              return (
                <div key={p.id} className="activity-history__row">
                  <div className="activity-history__row-info">
                    <div className="activity-history__row-name">
                      {p.nombre} {p.apellidos}
                    </div>
                    <div className="activity-history__row-meta">
                      {p.categoria} · {p.estaca} · {p.barrio}
                    </div>
                  </div>
                  <span className="badge" style={{ background: meta.bg, color: meta.color }}>
                    {meta.label}
                  </span>
                </div>
              );
            })}
            {selectedAttendees.length === 0 && <div className="activity-history__empty">Nadie se registró en esta actividad todavía.</div>}
          </div>
        </>
      )}
    </div>
  );
}
