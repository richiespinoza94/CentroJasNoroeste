import { useFirestoreData } from '../../firebase/DataProvider.jsx';
import { computeStatCards, computeEstacaDist, computeBarrioDist } from '../../domain/stats.js';
import StatCards from '../shared/StatCards.jsx';
import DistributionBars from '../shared/DistributionBars.jsx';
import TablesConfig from './TablesConfig.jsx';
import UsersConfig from './UsersConfig.jsx';
import './AdminScreen.css';

export default function AdminScreen() {
  const { participants, tables, loading } = useFirestoreData();

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

      <div className="admin__stats">
        <StatCards cards={computeStatCards(participants, tables)} />
      </div>

      <div className="admin__dist-row">
        <DistributionBars title="Avance por estaca" rows={computeEstacaDist(participants)} color="var(--navy-800)" />
        <DistributionBars title="Detalle por barrio" rows={computeBarrioDist(participants)} color="var(--gold-500)" scroll />
      </div>

      <TablesConfig tables={tables} />
      <UsersConfig />
    </div>
  );
}
