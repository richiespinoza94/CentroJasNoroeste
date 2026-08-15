import { useState } from 'react';
import { useStore } from '../../state/store.jsx';
import { getUsernameStatus, signInStaff, signUpStaff } from '../../firebase/auth.js';
import { PIN_RE } from '../../domain/constants.js';
import Field from '../ui/Field.jsx';
import './LoginScreen.css';

export default function LoginScreen() {
  const { state, dispatch } = useStore();
  const { loginStep, loginUsername, loginPinA, loginPinB, loginPinEnter, loginError } = state;
  const [busy, setBusy] = useState(false);

  const digits = (v) => v.replace(/\D/g, '').slice(0, 4);

  async function handleContinue() {
    if (!loginUsername.trim()) return;
    setBusy(true);
    try {
      const { status } = await getUsernameStatus(loginUsername);
      if (status === 'unknown') dispatch({ type: 'LOGIN_SET_STEP', step: 'not-found' });
      else if (status === 'pending') dispatch({ type: 'LOGIN_SET_STEP', step: 'create-pin' });
      else dispatch({ type: 'LOGIN_SET_STEP', step: 'pin' });
    } catch {
      dispatch({ type: 'LOGIN_SET_STEP', step: 'username', error: 'No se pudo verificar el usuario. Revisa tu conexión.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePin() {
    if (!PIN_RE.test(loginPinA)) {
      dispatch({ type: 'LOGIN_SET_STEP', step: 'create-pin', error: 'El PIN debe tener 4 dígitos.' });
      return;
    }
    if (loginPinA !== loginPinB) {
      dispatch({ type: 'LOGIN_SET_STEP', step: 'create-pin', error: 'Los PIN no coinciden.' });
      return;
    }
    setBusy(true);
    try {
      await signUpStaff(loginUsername, loginPinA);
      // App.jsx advances off the login screen once AuthProvider's context
      // actually reflects the new session — see the comment there for why
      // navigating from here directly is racy.
      dispatch({ type: 'LOGIN_RESET_ALL' });
    } catch (err) {
      dispatch({ type: 'LOGIN_SET_STEP', step: 'create-pin', error: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitPin() {
    setBusy(true);
    try {
      await signInStaff(loginUsername, loginPinEnter);
      dispatch({ type: 'LOGIN_RESET_ALL' });
    } catch (err) {
      dispatch({ type: 'LOGIN_SET_STEP', step: 'pin', error: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-card">
      <h2 className="login-card__title">Acceso staff</h2>

      {loginStep === 'username' && (
        <>
          <Field id="loginUsername" label="Usuario" error={loginError}>
            {(a) => (
              <input
                {...a}
                type="text"
                autoFocus
                autoComplete="username"
                value={loginUsername}
                onChange={(e) => dispatch({ type: 'LOGIN_SET_USERNAME', value: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                placeholder="ej. fiorella"
              />
            )}
          </Field>
          <button type="button" className="login-card__primary press" disabled={busy} onClick={handleContinue}>
            {busy ? 'Verificando…' : 'Continuar'}
          </button>
        </>
      )}

      {loginStep === 'not-found' && (
        <>
          <div className="login-card__notice" role="alert">
            Tu usuario "{loginUsername}" no está registrado. Pide a un admin que te cree una cuenta.
          </div>
          <button type="button" className="login-card__ghost press" onClick={() => dispatch({ type: 'LOGIN_BACK' })}>
            Volver
          </button>
        </>
      )}

      {loginStep === 'create-pin' && (
        <>
          <p className="login-card__hint">Primera vez que ingresas, {loginUsername}. Crea tu PIN de 4 dígitos.</p>
          <Field id="loginPinA" label="Nuevo PIN">
            {(a) => (
              <input
                {...a}
                className="field__control login-card__pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
                maxLength={4}
                value={loginPinA}
                onChange={(e) => dispatch({ type: 'LOGIN_SET_PIN_A', value: digits(e.target.value) })}
                placeholder="Nuevo PIN"
              />
            )}
          </Field>
          <Field id="loginPinB" label="Confirmar PIN">
            {(a) => (
              <input
                {...a}
                className="field__control login-card__pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={loginPinB}
                onChange={(e) => dispatch({ type: 'LOGIN_SET_PIN_B', value: digits(e.target.value) })}
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePin()}
                placeholder="Confirmar PIN"
              />
            )}
          </Field>
          {loginError && (
            <span className="field-error" role="alert">
              {loginError}
            </span>
          )}
          <button type="button" className="login-card__accent press" disabled={busy} onClick={handleCreatePin}>
            {busy ? 'Creando…' : 'Crear PIN e ingresar'}
          </button>
          <button type="button" className="login-card__link press" onClick={() => dispatch({ type: 'LOGIN_BACK' })}>
            Volver
          </button>
        </>
      )}

      {loginStep === 'pin' && (
        <>
          <p className="login-card__hint">Hola, {loginUsername}. Ingresa tu PIN.</p>
          <Field id="loginPinEnter" label="PIN">
            {(a) => (
              <input
                {...a}
                className="field__control login-card__pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
                maxLength={4}
                value={loginPinEnter}
                onChange={(e) => dispatch({ type: 'LOGIN_SET_PIN_ENTER', value: digits(e.target.value) })}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitPin()}
                placeholder="PIN"
              />
            )}
          </Field>
          {loginError && (
            <span className="field-error" role="alert">
              {loginError}
            </span>
          )}
          <button type="button" className="login-card__primary press" disabled={busy} onClick={handleSubmitPin}>
            {busy ? 'Ingresando…' : 'Ingresar'}
          </button>
          <button type="button" className="login-card__link press" onClick={() => dispatch({ type: 'LOGIN_BACK' })}>
            Volver
          </button>
        </>
      )}
    </div>
  );
}
