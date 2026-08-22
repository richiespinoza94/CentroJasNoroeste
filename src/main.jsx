import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { StoreProvider } from './state/store.jsx';
import { ToastProvider } from './hooks/useToast.jsx';
import { AuthProvider } from './firebase/AuthProvider.jsx';
import { DataProvider } from './firebase/DataProvider.jsx';
import './styles/tokens.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <DataProvider>
        <StoreProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </StoreProvider>
      </DataProvider>
    </AuthProvider>
  </StrictMode>
);

// Solo en producción — en desarrollo un service worker registrado puede
// quedar "pegado" sirviendo una versión vieja entre recargas de Vite, que
// es justo el tipo de confusión que este archivo intenta evitar en general.
// Se registra después de que la app ya renderizó — no debe competir con el
// primer pintado por ningún motivo.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
