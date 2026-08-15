import { useStore } from '../../state/store.jsx';
import { ROLE_LABELS } from '../../domain/constants.js';
import { computeStatCards } from '../../domain/stats.js';
import SearchTab from './SearchTab.jsx';
import TablesTab from './TablesTab.jsx';
import ManualTab from './ManualTab.jsx';
import StatCards from '../shared/StatCards.jsx';
import './ReceptionScreen.css';

const TABS = [
  { id: 'buscar', label: 'Buscar' },
  { id: 'mesas', label: 'Vista de mesas' },
  { id: 'manual', label: 'Registro manual' },
  { id: 'dashboard', label: 'Dashboard' },
];

export default function ReceptionScreen() {
  const { state, dispatch } = useStore();
  const { loggedInUser, receptionTab, participants, tables } = state;

  return (
    <div className="reception">
      <div className="reception__header">
        <div>
          <h2 className="reception__title">Recepción — La Velada 2026</h2>
          <div className="reception__subtitle">
            {loggedInUser.username} · {ROLE_LABELS[loggedInUser.role]}
          </div>
        </div>
      </div>

      <div className="reception__tabs" role="tablist" aria-label="Secciones de recepción">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={receptionTab === t.id}
            className="reception__tab press"
            onClick={() => dispatch({ type: 'SET_TAB', tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {receptionTab === 'buscar' && <SearchTab />}
      {receptionTab === 'mesas' && <TablesTab />}
      {receptionTab === 'manual' && <ManualTab />}
      {receptionTab === 'dashboard' && <StatCards cards={computeStatCards(participants, tables)} />}
    </div>
  );
}
