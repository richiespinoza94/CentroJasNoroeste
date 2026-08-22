import { useEffect, useRef, useState } from 'react';
import './Modal.css';

const FOCUSABLE = 'input, select, textarea, button:not([disabled]), a[href]';

/**
 * Modal de hoja/tarjeta con las interacciones ya validadas en el modal de
 * edición de Personas: anima entrada/salida (nunca aparece de golpe), atrapa
 * el foco con Tab, cierra con Escape/click-afuera, bloquea el scroll de
 * fondo, y devuelve el foco al elemento que lo abrió. Extraído aquí porque
 * ya es el segundo lugar que lo necesita (Personas y ahora el QR de
 * Actividades) — dos usos reales, no una abstracción especulativa.
 */
export default function Modal({ onClose, triggerRef, label, children, wide = false }) {
  const [closing, setClosing] = useState(false);
  const dialogRef = useRef(null);

  function requestClose() {
    setClosing(true);
    setTimeout(() => {
      onClose();
      triggerRef?.current?.focus();
    }, 180);
  }

  useEffect(() => {
    dialogRef.current?.querySelector(FOCUSABLE)?.focus();
    document.body.style.overflow = 'hidden';

    function handleKey(e) {
      if (e.key === 'Escape') {
        requestClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`ui-modal__backdrop${closing ? ' ui-modal__backdrop--closing' : ''}`} onClick={(e) => e.target === e.currentTarget && requestClose()}>
      <div
        className={`ui-modal${wide ? ' ui-modal--wide' : ''}${closing ? ' ui-modal--closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        ref={dialogRef}
      >
        {children(requestClose)}
      </div>
    </div>
  );
}
