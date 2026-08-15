import { useToastList } from '../../hooks/useToast.jsx';
import { CheckIcon, AlertIcon, CloseIcon } from './Icon.jsx';
import './ToastHost.css';

export default function ToastHost() {
  const { toasts, dismiss } = useToastList();
  if (toasts.length === 0) return null;
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone}`}>
          {t.tone === 'error' ? <AlertIcon /> : <CheckIcon />}
          <span>{t.message}</span>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Cerrar aviso">
            <CloseIcon width={16} height={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
