import { useStore } from '../../state/store.jsx';
import Field from '../ui/Field.jsx';
import './LoginScreen.css';

export default function LoginScreen() {
  const { state, dispatch } = useStore();
  const { loginStep, loginUsername, loginPinA, loginPinB, loginPinEnter, loginError } = state;

  const digits = (v) => v.replace(/\D/g, '').slice(0, 4);

  return (
    <div className="login-card">
      <h2 className="login-card__title">Acceso staff</h2>

      {loginStep === 'username' && (
        <>
          <Field id="loginUsername" label="Usuario">
            {(a) => (
              <input
                {...a}
                type="text"
                autoFocus
                autoComplete="username"
                value={loginUsername}
                onChange={(e) => dispatch({ type: 'LOGIN_SET_USERNAME', value: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && dispatch({ type: 'LOGIN_CONTINUE' })}
                placeholder="ej. fiorella"
              />
            )}
          </Field>
          <button type="button" className="login-card__primary press" onClick={() => dispatch({ type: 'LOGIN_CONTINUE' })}>
            Continuar
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
                onKeyDown={(e) => e.key === 'Enter' && dispatch({ type: 'CREATE_PIN' })}
                placeholder="Confirmar PIN"
              />
            )}
          </Field>
          {loginError && (
            <span className="field-error" role="alert">
              {loginError}
            </span>
          )}
          <button type="button" className="login-card__accent press" onClick={() => dispatch({ type: 'CREATE_PIN' })}>
            Crear PIN e ingresar
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
                onKeyDown={(e) => e.key === 'Enter' && dispatch({ type: 'SUBMIT_PIN' })}
                placeholder="PIN"
              />
            )}
          </Field>
          {loginError && (
            <span className="field-error" role="alert">
              {loginError}
            </span>
          )}
          <button type="button" className="login-card__primary press" onClick={() => dispatch({ type: 'SUBMIT_PIN' })}>
            Ingresar
          </button>
          <button type="button" className="login-card__link press" onClick={() => dispatch({ type: 'LOGIN_BACK' })}>
            Volver
          </button>
        </>
      )}
    </div>
  );
}
