import { useEffect, useRef } from 'react';
import { useStore } from '../../state/store.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { ROLE_LABELS } from '../../domain/constants.js';
import './UsersConfig.css';

export default function UsersConfig() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const { users, newUserName, newUserRole, newUserError, loggedInUser } = state;
  const prevCount = useRef(users.length);

  useEffect(() => {
    if (users.length > prevCount.current) toast(`Usuario ${users[users.length - 1].username} creado.`);
    prevCount.current = users.length;
  }, [users, toast]);

  function handleRemove(u) {
    if (u.username === loggedInUser.username) {
      toast('No puedes eliminar tu propia cuenta mientras la usas.', 'error');
      return;
    }
    if (!window.confirm(`¿Eliminar el usuario "${u.username}"? Perderá acceso de inmediato.`)) return;
    dispatch({ type: 'REMOVE_USER', username: u.username });
    toast(`Usuario ${u.username} eliminado.`);
  }

  function handleAdd() {
    dispatch({ type: 'ADD_USER' });
  }

  return (
    <div className="admin__panel">
      <div className="admin__panel-title" style={{ marginBottom: 12 }}>
        Usuarios del sistema
      </div>

      <div className="users-config__list">
        {users.map((u) => (
          <div className="users-config__row" key={u.username}>
            <div>
              <span className="users-config__name">{u.username}</span>
              <span className="users-config__meta">
                {ROLE_LABELS[u.role]} · {u.pin ? 'PIN activo' : 'Sin PIN (primer ingreso)'}
              </span>
            </div>
            <button type="button" className="users-config__delete press" onClick={() => handleRemove(u)}>
              Eliminar
            </button>
          </div>
        ))}
      </div>

      <div className="users-config__new">
        <div className="users-config__field">
          <label className="users-config__field-label" htmlFor="newUserName">
            Usuario nuevo
          </label>
          <input id="newUserName" type="text" value={newUserName} onChange={(e) => dispatch({ type: 'SET_NEW_USER_NAME', value: e.target.value })} placeholder="ej. karen" />
        </div>
        <div className="users-config__field">
          <label className="users-config__field-label" htmlFor="newUserRole">
            Rol
          </label>
          <select id="newUserRole" value={newUserRole} onChange={(e) => dispatch({ type: 'SET_NEW_USER_ROLE', value: e.target.value })}>
            <option value="recepcion">Recepción</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="button" className="users-config__create press" onClick={handleAdd}>
          Crear usuario
        </button>
      </div>
      {newUserError && (
        <div className="field-error" style={{ marginTop: 8 }} role="alert">
          {newUserError}
        </div>
      )}
    </div>
  );
}
