import { useStore } from '../state/store.jsx';
import { useAuth } from '../firebase/AuthProvider.jsx';
import { signOutStaff } from '../firebase/auth.js';
import { ROLE_LABELS } from '../domain/constants.js';
import './NavBar.css';

export default function NavBar() {
  const { state, dispatch } = useStore();
  const { user } = useAuth();
  const isLoggedIn = !!user;
  const isAdmin = isLoggedIn && user.role === 'admin';

  const nav = (screen) => dispatch({ type: 'NAV', screen });

  async function handleLogout() {
    await signOutStaff();
    dispatch({ type: 'LOGIN_RESET_ALL' });
    nav('publico');
  }

  return (
    <nav className="navbar" aria-label="Navegación principal">
      <span className="navbar__brand">Centro JAS · La Velada</span>

      <button type="button" className="navbar__btn press" aria-current={state.screen === 'publico' ? 'page' : undefined} onClick={() => nav('publico')}>
        Formulario
      </button>

      {!isLoggedIn && (
        <button type="button" className="navbar__btn press" aria-current={state.screen === 'login' ? 'page' : undefined} onClick={() => nav('login')}>
          Acceso staff
        </button>
      )}

      {isLoggedIn && (
        <button type="button" className="navbar__btn press" aria-current={state.screen === 'recepcion' ? 'page' : undefined} onClick={() => nav('recepcion')}>
          Recepción
        </button>
      )}

      {isAdmin && (
        <button type="button" className="navbar__btn press" aria-current={state.screen === 'admin' ? 'page' : undefined} onClick={() => nav('admin')}>
          Admin
        </button>
      )}

      {isLoggedIn && (
        <div className="navbar__session">
          <span className="navbar__session-label">
            {user.username} · {ROLE_LABELS[user.role]}
          </span>
          <button type="button" className="navbar__logout press" onClick={handleLogout}>
            Salir
          </button>
        </div>
      )}
    </nav>
  );
}
