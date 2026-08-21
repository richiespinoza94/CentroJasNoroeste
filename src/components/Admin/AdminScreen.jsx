import { useState } from 'react';
import { useFirestoreData } from '../../firebase/DataProvider.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { computeStatCards, computeEstacaDist, computeBarrioDist } from '../../domain/stats.js';
import { DownloadIcon } from '../ui/Icon.jsx';
import StatCards from '../shared/StatCards.jsx';
import DistributionBars from '../shared/DistributionBars.jsx';
import TablesConfig from './TablesConfig.jsx';
import UsersConfig from './UsersConfig.jsx';
import ActivitiesConfig from './ActivitiesConfig.jsx';
import PersonasConfig from './PersonasConfig.jsx';
import './AdminScreen.css';

const TABS = [
  { id: 'actividades', label: 'Actividades' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'personas', label: 'Personas' },
  { id: 'mesas', label: 'Mesas' },
  { id: 'usuarios', label: 'Usuarios' },
];

export default function AdminScreen() {
  const { participants, tables, activities, personas, activeActivity, loading } = useFirestoreData();
  const toast = useToast();
  const [tab, setTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="admin">
        <div className="admin__loading">Cargando datos en tiempo real…</div>
      </div>
    );
  }

  const [downloading, setDownloading] = useState(false);

  async function handleDownloadReport() {
    if (participants.length === 0) {
      toast('No hay registrados todavía.', 'error');
      return;
    }
    setDownloading(true);
    try {
      const { downloadParticipantsReport } = await import('../../domain/report.js');
      downloadParticipantsReport(participants, tables);
      toast(`Reporte descargado — ${participants.length} registrados en 4 pestañas.`);
    } catch {
      toast('No se pudo generar el reporte.', 'error');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="admin">
      <h2 className="sr-only">Dashboard — Admin</h2>

      <div className="admin__tabs" role="tablist" aria-label="Secciones de administración">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className="admin__tab press"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <>
          <button type="button" className="admin__report-btn press" disabled={downloading} onClick={handleDownloadReport}>
            <DownloadIcon width={18} height={18} />
            {downloading ? 'Generando reporte…' : 'Descargar reporte de registrados (Excel, 4 pestañas)'}
          </button>

          <div className="admin__stats">
            <StatCards cards={computeStatCards(participants, tables)} />
          </div>
          <div className="admin__dist-row">
            <DistributionBars title="Avance por estaca" rows={computeEstacaDist(participants)} color="var(--navy-800)" />
            <DistributionBars title="Detalle por barrio" rows={computeBarrioDist(participants)} color="var(--gold-500)" />
          </div>
        </>
      )}

      {tab === 'actividades' && <ActivitiesConfig activities={activities} />}
      {tab === 'personas' && <PersonasConfig personas={personas} participants={participants} activeActivity={activeActivity} />}
      {tab === 'mesas' && <TablesConfig tables={tables} />}
      {tab === 'usuarios' && <UsersConfig />}
    </div>
  );
}
