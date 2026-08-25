import { Component, Suspense, lazy, useEffect } from 'react';
import { useStore } from './state/store.jsx';
import { useAuth } from './firebase/AuthProvider.jsx';
import NavBar from './components/NavBar.jsx';
import ToastHost from './components/ui/ToastHost.jsx';
import PublicScreen from './components/PublicForm/PublicScreen.jsx';
import './App.css';

// La gran mayoría de las visitas son gente escaneando un QR para llenar el
// formulario público — no tiene sentido que esas visitas descarguen todo
// el código de Login/Recepción/Admin (dashboards, gráficos, generación de
// QR, exportación a Excel...) antes de poder ver el formulario. Separar
// estas tres en sus propios chunks, cargados solo cuando realmente se
// navega a esa pantalla, es lo que más reduce el peso inicial para el caso
// más común.
const LoginScreen = lazy(() => import('./components/Login/LoginScreen.jsx'));
const ReceptionScreen = lazy(() => import('./components/Reception/ReceptionScreen.jsx'));
const AdminScreen = lazy(() => import('./components/Admin/AdminScreen.jsx'));

function ScreenLoading() {
  return <div className="app-screen-loading">Cargando…</div>;
}

class StaffErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('[staff-ui] screen crashed:', error);
  }

  render() {
    if (this.state.failed) {
      return <div className="app-screen-loading" role="alert">No pudimos cargar esta sección. Recarga la página.</div>;
    }
    return this.props.children;
  }
}

export default function App() {
  const { state, dispatch } = useStore();
  const { user, loading: authLoading } = useAuth();
  const isLoggedIn = !!user;
  const isAdmin = isLoggedIn && user.role === 'admin';

  // Screen transitions driven by auth state live here, in one place, keyed
  // off `isLoggedIn` itself rather than dispatched optimistically right
  // after a sign-in call resolves — Firebase Auth's own promise resolving
  // is not the same moment the AuthProvider context re-renders with the new
  // user, and navigating on the former raced this effect's stale-session
  // guard into bouncing a just-logged-in staff member straight back to the
  // login screen.
  useEffect(() => {
    if (authLoading) return;
    if (isLoggedIn && state.screen === 'login') dispatch({ type: 'NAV', screen: 'recepcion' });
    if (state.screen === 'recepcion' && !isLoggedIn) dispatch({ type: 'NAV', screen: 'login' });
    if (state.screen === 'admin' && !isAdmin) dispatch({ type: 'NAV', screen: isLoggedIn ? 'recepcion' : 'login' });
  }, [state.screen, isLoggedIn, isAdmin, authLoading, dispatch]);

  return (
    <div className="app-shell">
      <NavBar />
      <main className="app-main">
        <div className="app-main__inner">
          {state.screen === 'publico' && <PublicScreen />}
          <StaffErrorBoundary key={state.screen}>
            <Suspense fallback={<ScreenLoading />}>
              {!authLoading && state.screen === 'login' && <LoginScreen />}
              {!authLoading && state.screen === 'recepcion' && isLoggedIn && <ReceptionScreen />}
              {!authLoading && state.screen === 'admin' && isAdmin && <AdminScreen />}
            </Suspense>
          </StaffErrorBoundary>
        </div>
      </main>
      <ToastHost />
    </div>
  );
}
