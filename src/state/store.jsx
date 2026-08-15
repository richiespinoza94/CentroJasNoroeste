import { createContext, useContext, useMemo, useReducer } from 'react';

// Local, device-only UI state: form drafts, which tab/screen is showing,
// login-flow progress. Shared data (participants, tables, staff) lives in
// Firestore now — see firebase/DataProvider.jsx and firebase/AuthProvider.jsx
// — this store never holds it, so there's nothing here to keep in sync with
// the database and nothing to lose by not persisting it.

const EMPTY_FORM = {
  nombre: '',
  apellidos: '',
  fechaNacimiento: '',
  sexo: '',
  categoria: '',
  whatsapp: '',
  estaca: '',
  barrio: '',
  estacaOtra: '',
  correo: '',
  privacidad: false,
};

const EMPTY_MANUAL = { nombre: '', apellidos: '', whatsapp: '', estaca: '', barrio: '', categoria: 'Miembro' };

const initialState = {
  screen: 'publico',
  formStep: 'form',
  form: { ...EMPTY_FORM },
  touched: {},
  attempted: false,
  confirmed: null,

  loginStep: 'username',
  loginUsername: '',
  loginPinA: '',
  loginPinB: '',
  loginPinEnter: '',
  loginError: '',

  newUserName: '',
  newUserRole: 'recepcion',
  newUserError: '',

  receptionTab: 'buscar',
  search: '',
  selectedId: null,

  manual: { ...EMPTY_MANUAL },
  manualError: '',
  manualSuccess: '',
};

function reducer(state, action) {
  switch (action.type) {
    case 'NAV':
      return { ...state, screen: action.screen };

    case 'SET_FORM':
      return { ...state, form: { ...state.form, ...action.patch } };
    case 'TOUCH_FIELD':
      return { ...state, touched: { ...state.touched, [action.field]: true } };
    case 'SUBMIT_ATTEMPT':
      return { ...state, attempted: true };
    case 'FORM_SUCCESS':
      return { ...state, formStep: 'confirm', confirmed: action.confirmed, attempted: false, touched: {} };
    case 'RESET_FORM':
      return { ...state, formStep: 'form', attempted: false, touched: {}, confirmed: null, form: { ...EMPTY_FORM } };

    case 'LOGIN_SET_USERNAME':
      return { ...state, loginUsername: action.value };
    case 'LOGIN_SET_PIN_A':
      return { ...state, loginPinA: action.value };
    case 'LOGIN_SET_PIN_B':
      return { ...state, loginPinB: action.value };
    case 'LOGIN_SET_PIN_ENTER':
      return { ...state, loginPinEnter: action.value };
    case 'LOGIN_SET_STEP':
      return { ...state, loginStep: action.step, loginError: action.error || '' };
    case 'LOGIN_BACK':
      return { ...state, loginStep: 'username', loginError: '', loginPinA: '', loginPinB: '', loginPinEnter: '' };
    case 'LOGIN_RESET_ALL':
      return { ...state, loginStep: 'username', loginUsername: '', loginPinA: '', loginPinB: '', loginPinEnter: '', loginError: '' };

    case 'SET_NEW_USER_NAME':
      return { ...state, newUserName: action.value };
    case 'SET_NEW_USER_ROLE':
      return { ...state, newUserRole: action.value };
    case 'NEW_USER_ERROR':
      return { ...state, newUserError: action.error };
    case 'NEW_USER_SUCCESS':
      return { ...state, newUserName: '', newUserError: '' };

    case 'SET_TAB':
      return { ...state, receptionTab: action.tab };
    case 'SET_SEARCH':
      return { ...state, search: action.value };
    case 'SELECT_PARTICIPANT':
      return { ...state, selectedId: action.id };

    case 'SET_MANUAL':
      return { ...state, manual: { ...state.manual, ...action.patch } };
    case 'MANUAL_ERROR':
      return { ...state, manualError: action.error, manualSuccess: '' };
    case 'MANUAL_SUCCESS':
      return { ...state, manualError: '', manualSuccess: action.message, manual: { ...EMPTY_MANUAL } };

    default:
      return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
