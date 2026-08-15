import { useEffect } from 'react';
import { useStore } from './state/store.jsx';
import NavBar from './components/NavBar.jsx';
import ToastHost from './components/ui/ToastHost.jsx';
import PublicScreen from './components/PublicForm/PublicScreen.jsx';
import LoginScreen from './components/Login/LoginScreen.jsx';
import ReceptionScreen from './components/Reception/ReceptionScreen.jsx';
import AdminScreen from './components/Admin/AdminScreen.jsx';
import './App.css';

export default function App() {
  const { state, dispatch } = useStore();
  const isLoggedIn = !!state.loggedInUser;
  const isAdmin = isLoggedIn && state.loggedInUser.role === 'admin';

  // Guard rails: an unauthenticated tab landing on a staff screen (e.g. a
  // stale bookmark) is sent to login instead of rendering a blank page.
  useEffect(() => {
    if (state.screen === 'recepcion' && !isLoggedIn) dispatch({ type: 'NAV', screen: 'login' });
    if (state.screen === 'admin' && !isAdmin) dispatch({ type: 'NAV', screen: isLoggedIn ? 'recepcion' : 'login' });
  }, [state.screen, isLoggedIn, isAdmin, dispatch]);

  return (
    <div className="app-shell">
      <NavBar />
      <main className="app-main">
        <div className="app-main__inner">
          {state.screen === 'publico' && <PublicScreen />}
          {state.screen === 'login' && <LoginScreen />}
          {state.screen === 'recepcion' && isLoggedIn && <ReceptionScreen />}
          {state.screen === 'admin' && isAdmin && <AdminScreen />}
        </div>
      </main>
      <ToastHost />
    </div>
  );
}
