import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { DEFAULT_TABLES, DEFAULT_USERS, SEED_PARTICIPANTS } from '../domain/constants.js';
import { validateRegistration, validateManual } from '../domain/validation.js';

const STORAGE_KEY = 'cjn-la-velada-v1';

const EMPTY_FORM = {
  nombre: '',
  apellidos: '',
  fechaNacimiento: '',
  sexo: '',
  tipoParticipante: '',
  whatsapp: '',
  estaca: '',
  barrio: '',
  estacaOtra: '',
  correo: '',
  privacidad: false,
};

const EMPTY_MANUAL = { nombre: '', apellidos: '', whatsapp: '', estaca: '', barrio: '', categoria: 'participante' };

function loadPersisted() {
  // ponytail: localStorage stands in for Firestore until the backend lands —
  // swap this load/save pair for real listeners then, nothing else changes.
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function initialState() {
  const persisted = loadPersisted();
  return {
    screen: 'publico',
    formStep: 'form',
    form: { ...EMPTY_FORM },
    touched: {},
    attempted: false,
    confirmed: null,

    users: persisted?.users ?? DEFAULT_USERS.slice(),
    loggedInUser: null,
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

    participants: persisted?.participants ?? SEED_PARTICIPANTS.slice(),
    nextId: persisted?.nextId ?? 7,
    tables: persisted?.tables ?? DEFAULT_TABLES.slice(),
    nextTableId: persisted?.nextTableId ?? 10,
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'NAV':
      return { ...state, screen: action.screen };

    case 'SET_FORM':
      return { ...state, form: { ...state.form, ...action.patch } };
    case 'TOUCH_FIELD':
      return { ...state, touched: { ...state.touched, [action.field]: true } };

    case 'SUBMIT_FORM': {
      const errors = validateRegistration(state.form, state.participants);
      if (Object.keys(errors).length > 0) return { ...state, attempted: true };
      const f = state.form;
      const id = state.nextId;
      const codigo = `JAS-${String(id).padStart(4, '0')}`;
      const person = {
        id,
        nombre: f.nombre.trim(),
        apellidos: f.apellidos.trim(),
        sexo: f.sexo,
        tipoParticipante: f.tipoParticipante,
        whatsapp: f.whatsapp,
        estaca: f.estaca === 'Otra estaca' ? f.estacaOtra.trim() : f.estaca,
        barrio: f.barrio.trim(),
        correo: f.correo,
        categoria: 'participante',
        status: 'pendiente',
        tableId: null,
      };
      return {
        ...state,
        participants: [...state.participants, person],
        nextId: id + 1,
        confirmed: {
          nombreCompleto: `${person.nombre} ${person.apellidos}`,
          codigo,
          estacaBarrio: `${person.estaca} · ${person.barrio}`,
        },
        formStep: 'confirm',
      };
    }
    case 'RESET_FORM':
      return { ...state, formStep: 'form', attempted: false, touched: {}, confirmed: null, form: { ...EMPTY_FORM } };

    case 'LOGIN_SET_USERNAME':
      return { ...state, loginUsername: action.value };
    case 'LOGIN_CONTINUE': {
      const uname = state.loginUsername.trim().toLowerCase();
      const user = state.users.find((u) => u.username.toLowerCase() === uname);
      if (!user) return { ...state, loginStep: 'not-found', loginError: '' };
      return { ...state, loginStep: user.pin ? 'pin' : 'create-pin', loginError: '', loginPinA: '', loginPinB: '', loginPinEnter: '' };
    }
    case 'LOGIN_BACK':
      return { ...state, loginStep: 'username', loginError: '', loginPinA: '', loginPinB: '', loginPinEnter: '' };
    case 'LOGIN_SET_PIN_A':
      return { ...state, loginPinA: action.value };
    case 'LOGIN_SET_PIN_B':
      return { ...state, loginPinB: action.value };
    case 'LOGIN_SET_PIN_ENTER':
      return { ...state, loginPinEnter: action.value };
    case 'CREATE_PIN': {
      const { loginPinA, loginPinB } = state;
      if (!/^\d{4}$/.test(loginPinA)) return { ...state, loginError: 'El PIN debe tener 4 dígitos.' };
      if (loginPinA !== loginPinB) return { ...state, loginError: 'Los PIN no coinciden.' };
      const uname = state.loginUsername.trim().toLowerCase();
      const users = state.users.map((u) => (u.username.toLowerCase() === uname ? { ...u, pin: loginPinA } : u));
      const user = users.find((u) => u.username.toLowerCase() === uname);
      return { ...state, users, loggedInUser: user, screen: 'recepcion', loginError: '' };
    }
    case 'SUBMIT_PIN': {
      const uname = state.loginUsername.trim().toLowerCase();
      const user = state.users.find((u) => u.username.toLowerCase() === uname);
      if (!user || user.pin !== state.loginPinEnter) return { ...state, loginError: 'PIN incorrecto.' };
      return { ...state, loggedInUser: user, screen: 'recepcion', loginError: '' };
    }
    case 'LOGOUT':
      return { ...state, loggedInUser: null, screen: 'publico', loginStep: 'username', loginUsername: '', loginPinA: '', loginPinB: '', loginPinEnter: '' };

    case 'SET_NEW_USER_NAME':
      return { ...state, newUserName: action.value };
    case 'SET_NEW_USER_ROLE':
      return { ...state, newUserRole: action.value };
    case 'ADD_USER': {
      const uname = state.newUserName.trim();
      if (uname.length < 2) return { ...state, newUserError: 'Nombre de usuario muy corto.' };
      if (state.users.find((u) => u.username.toLowerCase() === uname.toLowerCase())) {
        return { ...state, newUserError: 'Ese usuario ya existe.' };
      }
      return {
        ...state,
        users: [...state.users, { username: uname, role: state.newUserRole, pin: null }],
        newUserName: '',
        newUserError: '',
      };
    }
    case 'REMOVE_USER':
      return { ...state, users: state.users.filter((u) => u.username !== action.username) };

    case 'ADD_TABLE':
      return {
        ...state,
        tables: [...state.tables, { id: state.nextTableId, name: `Mesa ${state.nextTableId}`, capacity: 10, reservedFor: null }],
        nextTableId: state.nextTableId + 1,
      };
    case 'REMOVE_TABLE':
      return {
        ...state,
        tables: state.tables.filter((t) => t.id !== action.id),
        participants: state.participants.map((p) =>
          p.tableId === action.id ? { ...p, tableId: null, status: 'presente' } : p
        ),
      };
    case 'SET_TABLE_CAPACITY': {
      const cap = Math.max(1, parseInt(action.value, 10) || 1);
      return { ...state, tables: state.tables.map((t) => (t.id === action.id ? { ...t, capacity: cap } : t)) };
    }
    case 'SET_TABLE_RESERVED':
      return {
        ...state,
        tables: state.tables.map((t) => (t.id === action.id ? { ...t, reservedFor: action.value || null } : t)),
      };

    case 'SET_TAB':
      return { ...state, receptionTab: action.tab };
    case 'SET_SEARCH':
      return { ...state, search: action.value };
    case 'SELECT_PARTICIPANT':
      return { ...state, selectedId: action.id };
    case 'CHECK_IN':
      return { ...state, participants: state.participants.map((p) => (p.id === action.id ? { ...p, status: 'presente' } : p)) };
    case 'ASSIGN_TABLE':
      return {
        ...state,
        participants: state.participants.map((p) =>
          p.id === action.id ? { ...p, status: 'asignado', tableId: action.tableId } : p
        ),
      };
    case 'UNASSIGN_TABLE':
      return {
        ...state,
        participants: state.participants.map((p) => (p.id === action.id ? { ...p, status: 'presente', tableId: null } : p)),
      };

    case 'SET_MANUAL':
      return { ...state, manual: { ...state.manual, ...action.patch } };
    case 'SUBMIT_MANUAL': {
      const m = state.manual;
      const error = validateManual(m, state.participants);
      if (error) return { ...state, manualError: error, manualSuccess: '' };
      const id = state.nextId;
      const person = {
        id,
        nombre: m.nombre.trim(),
        apellidos: m.apellidos.trim(),
        sexo: '',
        tipoParticipante: 'Miembro',
        whatsapp: m.whatsapp,
        estaca: m.estaca,
        barrio: m.barrio.trim(),
        correo: '',
        categoria: m.categoria,
        status: 'presente',
        tableId: null,
      };
      return {
        ...state,
        participants: [...state.participants, person],
        nextId: id + 1,
        manualError: '',
        manualSuccess: `${person.nombre} registrado(a) y presente.`,
        manual: { ...EMPTY_MANUAL },
      };
    }

    default:
      return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  useEffect(() => {
    const toPersist = {
      participants: state.participants,
      nextId: state.nextId,
      tables: state.tables,
      nextTableId: state.nextTableId,
      users: state.users,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
    } catch {
      // storage full or unavailable — event carries on with in-memory state only
    }
  }, [state.participants, state.nextId, state.tables, state.nextTableId, state.users]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
