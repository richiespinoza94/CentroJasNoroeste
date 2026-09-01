import { useEffect, useRef } from 'react';
import { useStore } from '../../state/store.jsx';
import { CheckIcon } from '../ui/Icon.jsx';
import './ConfirmationScreen.css';

/**
 * El formulario público solo se llena en el lugar, el mismo día del
 * evento — escanear el QR o abrir el link ya implica estar ahí. Por eso
 * `registerParticipant` guarda status: 'presente' directo (ver
 * collections.js) y esta pantalla confirma la asistencia sin pedir un
 * paso aparte en Recepción — antes decía "pendiente ingreso", lo cual
 * hacía pensar a alguien que ya estaba físicamente presente y con el
 * formulario lleno que le faltaba algo más por hacer.
 */
export default function ConfirmationScreen() {
  const { state, dispatch } = useStore();
  const { confirmed } = state;
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  if (!confirmed) return null;

  return (
    <div className="confirm" role="status">
      <div className="confirm__badge">
        <CheckIcon width={32} height={32} />
      </div>
      <h2 className="confirm__title" tabIndex={-1} ref={headingRef}>
        ¡Asistencia confirmada!
      </h2>
      <div className="confirm__body">{confirmed.nombreCompleto}</div>
      <div className="confirm__code tabular">{confirmed.codigo}</div>
      <div className="confirm__sub">{confirmed.estacaBarrio}</div>
      <div className="confirm__note">Ya quedaste registrado(a) para esta actividad. ¡Que la disfrutes!</div>

      <button type="button" className="confirm__reset press" onClick={() => dispatch({ type: 'RESET_FORM' })}>
        Nuevo registro
      </button>
    </div>
  );
}
