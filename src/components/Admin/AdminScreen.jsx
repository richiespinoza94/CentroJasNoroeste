import { useStore } from '../../state/store.jsx';
import { computeStatCards, computeEstacaDist, computeBarrioDist } from '../../domain/stats.js';
import StatCards from '../shared/StatCards.jsx';
import DistributionBars from '../shared/DistributionBars.jsx';
import TablesConfig from './TablesConfig.jsx';
import UsersConfig from './UsersConfig.jsx';
import './AdminScreen.css';

export default function AdminScreen() {
  const { state } = useStore();
  const { participants, tables } = state;

  return (
    <div className="admin">
      <h2 className="admin__title">Dashboard — Admin</h2>
      <div className="admin__subtitle">Actualización en tiempo real (simulada) · La Velada 2026</div>

      <div className="admin__stats">
        <StatCards cards={computeStatCards(participants, tables)} />
      </div>

      <div className="admin__dist-row">
        <DistributionBars
          title="Distribución por estaca"
          rows={computeEstacaDist(participants).map((r) => ({ label: r.label, count: r.count, pct: r.pct }))}
          color="var(--navy-800)"
        />
        <DistributionBars
          title="Distribución por barrio"
          rows={computeBarrioDist(participants).map((r) => ({ label: r.label, count: r.count, pct: r.pct }))}
          color="var(--gold-500)"
          scroll
        />
      </div>

      <TablesConfig />
      <UsersConfig />
    </div>
  );
}
