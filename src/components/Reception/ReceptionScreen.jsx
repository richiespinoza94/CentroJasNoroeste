import { useRef, useState } from 'react';
import { useStore } from '../../state/store.jsx';
import { useFirestoreData } from '../../firebase/DataProvider.jsx';
import { computeStatCards, computeEstacaDist, computeBarrioDist } from '../../domain/stats.js';
import SearchTab from './SearchTab.jsx';
import ManualTab from './ManualTab.jsx';
import StatCards from '../shared/StatCards.jsx';
import DistributionBars from '../shared/DistributionBars.jsx';
import ActivityQRModal from '../shared/ActivityQRModal.jsx';
import './ReceptionScreen.css';

const TABS = [
  { id: 'buscar', label: 'Buscar' },
  { id: 'manual', label: 'Registro manual' },
  { id: 'dashboard', label: 'Dashboard' },
];

export default function ReceptionScreen() {
  const { state, dispatch } = useStore();
  const { participants, loading, activeActivity, error } = useFirestoreData();
  const { receptionTab } = state;
  const [qrOpen, setQrOpen] = useState(false);
  const qrTriggerRef = useRef(null);

  return (
    <div className="reception">
      <h2 className="sr-only">Recepción{activeActivity ? ` — ${activeActivity.nombre}` : ''}</h2>

      {/* Mismo QR que Admin → Actividades (mostrar/pantalla completa/
          compartir/imprimir) — recepción no siempre tiene acceso a Admin,
          pero sí necesita poder mostrarle el QR a alguien que llega sin
          haberlo escaneado antes. Se reusa el componente entero en vez de
          reconstruir esas cuatro acciones de nuevo (ponytail). */}
      {activeActivity && (
        <div className="reception__activity-bar">
          <div className="reception__activity-name">{activeActivity.nombre}</div>
          <button type="button" className="reception__qr-btn press" ref={qrTriggerRef} onClick={() => setQrOpen(true)}>
            QR
          </button>
        </div>
      )}

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

      {error ? (
        <div className="reception__loading" role="alert">{error}</div>
      ) : loading ? (
        <div className="reception__loading">Cargando datos en tiempo real…</div>
      ) : (
        <>
          {receptionTab === 'buscar' && <SearchTab />}
          {receptionTab === 'manual' && <ManualTab />}
          {receptionTab === 'dashboard' && (
            <>
              <StatCards cards={computeStatCards(participants)} />
              <div className="reception__dist-row">
                <DistributionBars title="Avance por estaca" rows={computeEstacaDist(participants)} color="var(--navy-800)" />
                <DistributionBars title="Detalle por barrio" rows={computeBarrioDist(participants)} color="var(--gold-500)" />
              </div>
            </>
          )}
        </>
      )}

      {qrOpen && activeActivity && <ActivityQRModal activity={activeActivity} triggerRef={qrTriggerRef} onClose={() => setQrOpen(false)} />}
    </div>
  );
}
