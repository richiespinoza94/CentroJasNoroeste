import { useEffect } from 'react';
import { useStore } from './state/store.jsx';
import { useAuth } from './firebase/AuthProvider.jsx';
import NavBar from './components/NavBar.jsx';
import ToastHost from './components/ui/ToastHost.jsx';
import PublicScreen from './components/PublicForm/PublicScreen.jsx';
import LoginScreen from './components/Login/LoginScreen.jsx';
import ReceptionScreen from './components/Reception/ReceptionScreen.jsx';
import AdminScreen from './components/Admin/AdminScreen.jsx';
import './App.css';

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
          {!authLoading && state.screen === 'publico' && <PublicScreen />}
          {!authLoading && state.screen === 'login' && <LoginScreen />}
          {!authLoading && state.screen === 'recepcion' && isLoggedIn && <ReceptionScreen />}
          {!authLoading && state.screen === 'admin' && isAdmin && <AdminScreen />}
        </div>
      </main>
      <ToastHost />
    </div>
  );
}
