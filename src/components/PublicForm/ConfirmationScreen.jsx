import { useEffect, useRef } from 'react';
import { useStore } from '../../state/store.jsx';
import { CheckIcon, ClockIcon } from '../ui/Icon.jsx';
import './ConfirmationScreen.css';

/**
 * Dos estados visualmente separados a propósito, no uno solo:
 * 1. "Registro exitoso" (check verde/dorado) — lo que sí ya pasó.
 * 2. "Pendiente ingreso" (reloj, mismos colores que usa Recepción para
 *    este mismo estado — STATUS_META.pendiente) — lo que TODAVÍA falta.
 *
 * Antes decía solo "¡Registro completado!" con un check grande — fácil de
 * leer como "ya estoy confirmado(a)", sobre todo para alguien que escaneó
 * el QR, llenó el formulario, y nunca llega a pisar recepción pensando que
 * ya quedó todo listo. La asistencia real la confirma el staff en
 * recepción cuando la persona llega — este texto lo dice sin rodeos.
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
        ¡Registro exitoso!
      </h2>
      <div className="confirm__body">{confirmed.nombreCompleto}</div>
      <div className="confirm__code tabular">{confirmed.codigo}</div>
      <div className="confirm__sub">{confirmed.estacaBarrio}</div>

      <div className="confirm__pending">
        <ClockIcon width={20} height={20} />
        <div>
          <div className="confirm__pending-label">Pendiente ingreso</div>
          <div className="confirm__pending-text">Tu registro ya quedó guardado, pero tu asistencia todavía no está confirmada. Muestra este código en recepción cuando llegues.</div>
        </div>
      </div>

      <button type="button" className="confirm__reset press" onClick={() => dispatch({ type: 'RESET_FORM' })}>
        Nuevo registro
      </button>
    </div>
  );
}
