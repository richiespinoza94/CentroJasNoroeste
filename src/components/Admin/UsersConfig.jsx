import { useEffect, useState } from 'react';
import { useStore } from '../../state/store.jsx';
import { useAuth } from '../../firebase/AuthProvider.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { ROLE_LABELS } from '../../domain/constants.js';
import { addPendingStaff, removeStaffMember, subscribeAllStaff } from '../../firebase/auth.js';
import './UsersConfig.css';

export default function UsersConfig() {
  const { state, dispatch } = useStore();
  const { user } = useAuth();
  const toast = useToast();
  const { newUserName, newUserRole, newUserError } = state;
  const [users, setUsers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [busyUsername, setBusyUsername] = useState(null);

  useEffect(() => subscribeAllStaff(setUsers), []);

  async function handleRemove(u) {
    if (u.claimed && u.uid === user.uid) {
      toast('No puedes eliminar tu propia cuenta mientras la usas.', 'error');
      return;
    }
    if (!window.confirm(`¿Eliminar el usuario "${u.username}"? Perderá acceso de inmediato.`)) return;
    setBusyUsername(u.username);
    try {
      await removeStaffMember(u);
      toast(`Usuario ${u.username} eliminado.`);
    } catch (err) {
      toast(err.message || 'No se pudo eliminar el usuario.', 'error');
    } finally {
      setBusyUsername(null);
    }
  }

  async function handleAdd() {
    setCreating(true);
    try {
      await addPendingStaff(newUserName, newUserRole);
      dispatch({ type: 'NEW_USER_SUCCESS' });
      toast(`Usuario ${newUserName.trim()} creado.`);
    } catch (err) {
      dispatch({ type: 'NEW_USER_ERROR', error: err.message });
    } finally {
      setCreating(false);
    }
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
                {ROLE_LABELS[u.role]} · {u.claimed ? 'PIN activo' : 'Sin PIN (primer ingreso)'}
              </span>
            </div>
            <button type="button" className="users-config__delete press" disabled={busyUsername === u.username} onClick={() => handleRemove(u)}>
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
        <button type="button" className="users-config__create press" disabled={creating} onClick={handleAdd}>
          {creating ? 'Creando…' : 'Crear usuario'}
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
