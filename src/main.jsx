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
