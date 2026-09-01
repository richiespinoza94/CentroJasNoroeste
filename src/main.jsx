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

// El "Agregar a pantalla de inicio" de iOS funciona por los meta tags de
// index.html, no por el service worker (eso es específico de Android/Chrome)
// — así que en iOS este archivo no aporta nada. Y sí puede causar un
// problema real: hay un bug conocido de WebKit donde la vista previa del
// link que muestra la app Cámara al escanear un QR (antes de que la
// persona toque para abrirlo de verdad) falla si el sitio ya tiene un
// service worker registrado — mientras que escribir/pegar el mismo link a
// mano en Safari, que no pasa por esa vista previa, funciona sin problema.
// Coincide exactamente con lo reportado: el QR fallaba con un error de
// "problema con el servidor", pero el link a mano sí abría.
//
// Solo en producción — en desarrollo un service worker registrado puede
// quedar "pegado" sirviendo una versión vieja entre recargas de Vite, que
// es justo el tipo de confusión que este archivo intenta evitar en general.
// Se registra después de que la app ya renderizó — no debe competir con el
// primer pintado por ningún motivo.
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  if (isIOS) {
    // Limpia cualquier registro que ya haya quedado de una visita anterior
    // (por ejemplo, alguien que abrió el link normal en Safari antes de
    // escanear el QR después) — no basta con dejar de registrar uno nuevo.
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}
