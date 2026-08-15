import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store.jsx';
import { useAuth } from '../firebase/AuthProvider.jsx';
import { signOutStaff } from '../firebase/auth.js';
import { ROLE_LABELS } from '../domain/constants.js';
import { MenuIcon, DocumentIcon, CheckIcon, ShieldIcon } from './ui/Icon.jsx';
import './NavBar.css';

export default function NavBar() {
  const { state, dispatch } = useStore();
  const { user } = useAuth();
  const isLoggedIn = !!user;
  const isAdmin = isLoggedIn && user.role === 'admin';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  const nav = (screen) => {
    dispatch({ type: 'NAV', screen });
    setMenuOpen(false);
  };

  async function handleLogout() {
    setMenuOpen(false);
    await signOutStaff();
    dispatch({ type: 'LOGIN_RESET_ALL' });
    nav('publico');
  }

  // Disclosure simple (no el widget ARIA "menu" completo con navegación por
  // flechas — acá alcanza con botones normales): cierra al tocar afuera, con
  // Escape, y devuelve el foco al botón que lo abrió.
  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector('button')?.focus();

    function handlePointer(e) {
      if (menuRef.current && !menuRef.current.contains(e.target) && !triggerRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    function handleKey(e) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  return (
    <nav className="navbar" aria-label="Navegación principal">
      <div className="navbar__left">
        <button
          ref={triggerRef}
          type="button"
          className="navbar__menu-btn press"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          aria-label="Abrir menú de navegación"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <MenuIcon width={20} height={20} />
        </button>
        <span className="navbar__brand">Centro JAS · La Velada</span>
      </div>

      {isLoggedIn && (
        <div className="navbar__right">
          <span className="navbar__role">{ROLE_LABELS[user.role]}</span>
          <button type="button" className="navbar__logout press" onClick={handleLogout}>
            Salir
          </button>
        </div>
      )}

      {menuOpen && (
        <div className="navbar__menu" ref={menuRef}>
          {isLoggedIn && (
            <div className="navbar__menu-session">
              {user.username} · {ROLE_LABELS[user.role]}
            </div>
          )}

          <button type="button" className="navbar__menu-item press" aria-current={state.screen === 'publico' ? 'page' : undefined} onClick={() => nav('publico')}>
            <DocumentIcon width={18} height={18} />
            Formulario
          </button>

          {!isLoggedIn && (
            <button type="button" className="navbar__menu-item press" aria-current={state.screen === 'login' ? 'page' : undefined} onClick={() => nav('login')}>
              <ShieldIcon width={18} height={18} />
              Acceso staff
            </button>
          )}

          {isLoggedIn && (
            <button type="button" className="navbar__menu-item press" aria-current={state.screen === 'recepcion' ? 'page' : undefined} onClick={() => nav('recepcion')}>
              <CheckIcon width={18} height={18} />
              Recepción
            </button>
          )}

          {isAdmin && (
            <button type="button" className="navbar__menu-item press" aria-current={state.screen === 'admin' ? 'page' : undefined} onClick={() => nav('admin')}>
              <ShieldIcon width={18} height={18} />
              Admin
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
