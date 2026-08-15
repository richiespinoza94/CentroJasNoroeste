import { useEffect, useRef } from 'react';
import { useStore } from '../../state/store.jsx';
import { CheckIcon } from '../ui/Icon.jsx';
import './ConfirmationScreen.css';

export default function ConfirmationScreen() {
  const { state, dispatch } = useStore();
  const { confirmed } = state;
  const headingRef = useRef(null);

  // Move focus to the confirmation so screen-reader users get the outcome
  // immediately instead of the page silently re-rendering under them.
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
        ¡Registro completado!
      </h2>
      <div className="confirm__body">{confirmed.nombreCompleto}, muestra este código en recepción al llegar.</div>
      <div className="confirm__code tabular">{confirmed.codigo}</div>
      <div className="confirm__sub">{confirmed.estacaBarrio}</div>
      <button type="button" className="confirm__reset press" onClick={() => dispatch({ type: 'RESET_FORM' })}>
        Nuevo registro
      </button>
    </div>
  );
}
