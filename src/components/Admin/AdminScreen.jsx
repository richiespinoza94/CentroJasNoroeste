import { useState } from 'react';
import { useFirestoreData } from '../../firebase/DataProvider.jsx';
import { computeStatCards, computeEstacaDist, computeBarrioDist } from '../../domain/stats.js';
import StatCards from '../shared/StatCards.jsx';
import DistributionBars from '../shared/DistributionBars.jsx';
import TablesConfig from './TablesConfig.jsx';
import UsersConfig from './UsersConfig.jsx';
import './AdminScreen.css';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'mesas', label: 'Mesas' },
  { id: 'usuarios', label: 'Usuarios' },
];

export default function AdminScreen() {
  const { participants, tables, loading } = useFirestoreData();
  const [tab, setTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="admin">
        <div className="admin__loading">Cargando datos en tiempo real…</div>
      </div>
    );
  }

  return (
    <div className="admin">
      <h2 className="admin__title">Dashboard — Admin</h2>
      <div className="admin__subtitle">Actualización en tiempo real · La Velada 2026</div>

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
          <div className="admin__stats">
            <StatCards cards={computeStatCards(participants, tables)} />
          </div>
          <div className="admin__dist-row">
            <DistributionBars title="Avance por estaca" rows={computeEstacaDist(participants)} color="var(--navy-800)" />
            <DistributionBars title="Detalle por barrio" rows={computeBarrioDist(participants)} color="var(--gold-500)" />
          </div>
        </>
      )}

      {tab === 'mesas' && <TablesConfig tables={tables} />}
      {tab === 'usuarios' && <UsersConfig />}
    </div>
  );
}
