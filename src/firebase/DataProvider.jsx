import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { subscribePersonas, subscribeInscripciones, subscribeActivities } from './collections.js';
import { useAuth } from './AuthProvider.jsx';

const DataContext = createContext(null);

const toMillis = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0);

// Firestore rules only grant list access on personas/inscripciones to
// signed-in staff, so those listeners only start once a staff user is
// present — avoids a permission-denied round-trip on every visitor's phone.
// `activities` is different: it's publicly readable on purpose (the
// registration form needs the active event's name before anyone logs in),
// so it subscribes unconditionally.
export function DataProvider({ children }) {
  const { user } = useAuth();
  const [personas, setPersonas] = useState([]);
  const [inscripciones, setInscripciones] = useState([]);
  const [activities, setActivities] = useState([]);
  const [personasReady, setPersonasReady] = useState(false);
  const [inscripcionesReady, setInscripcionesReady] = useState(false);
  const [activitiesReady, setActivitiesReady] = useState(false);
  const [dataErrors, setDataErrors] = useState({
    activities: null,
    personas: null,
    inscripciones: null,
  });

  // Un dispositivo de Recepción típicamente queda abierto horas durante un
  // evento — la pantalla se bloquea, el navegador limita/pausa conexiones
  // en segundo plano para ahorrar batería, y en algunos casos el socket de
  // Firestore no se reconecta solo al volver (o sí se reconecta pero se
  // pierde algún evento intermedio) sin que haya ningún error visible: la
  // pantalla se queda mostrando datos viejos, en silencio, hasta que
  // alguien recarga a mano. `visibilitychange` es la señal estándar del
  // navegador para "la pestaña volvió a primer plano" — se usa para forzar
  // una reconexión limpia de los tres listeners en ese momento, en vez de
  // depender de que el staff note que algo quedó desactualizado.
  const [reconnectTick, setReconnectTick] = useState(0);
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') setReconnectTick((t) => t + 1);
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    const unsub = subscribeActivities(
      (rows) => {
        setActivities(rows);
        setActivitiesReady(true);
        setDataErrors((prev) => ({ ...prev, activities: null }));
      },
      () => {
        setActivitiesReady(true);
        setDataErrors((prev) => ({ ...prev, activities: 'No pudimos cargar las actividades. Revisa tu conexión y vuelve a intentarlo.' }));
      }
    );
    return unsub;
  }, [reconnectTick]);

  const activeActivity = useMemo(() => activities.find((a) => a.activa) || null, [activities]);

  useEffect(() => {
    if (!user) {
      setPersonas([]);
      setPersonasReady(false);
      setDataErrors((prev) => ({ ...prev, personas: null }));
      return;
    }
    setPersonasReady(false);
    const unsub = subscribePersonas(
      (rows) => {
        setPersonas(rows);
        setPersonasReady(true);
        setDataErrors((prev) => ({ ...prev, personas: null }));
      },
      () => {
        setPersonasReady(true);
        setDataErrors((prev) => ({ ...prev, personas: 'No pudimos cargar las personas. Revisa tu conexión o permisos.' }));
      }
    );
    return unsub;
  }, [user, reconnectTick]);

  // Scoped to whichever activity is active right now — this is what
  // Reception/Admin's day-to-day screens operate on. Depends on the
  // primitive id, not the `activeActivity` object — Firestore hands back a
  // new array/object reference on every snapshot of `activities`, even one
  // triggered by editing a *different*, inactive activity elsewhere in
  // Admin. Depending on the object would tear down and reopen this
  // subscription on every unrelated edit instead of only when the active
  // activity itself actually changes.
  const activeActivityId = activeActivity?.id ?? null;
  useEffect(() => {
    if (!user || !activeActivityId) {
      setInscripciones([]);
      setInscripcionesReady(!activeActivityId);
      setDataErrors((prev) => ({ ...prev, inscripciones: null }));
      return;
    }
    setInscripcionesReady(false);
    setDataErrors((prev) => ({ ...prev, inscripciones: null }));
    const unsub = subscribeInscripciones(
      activeActivityId,
      (rows) => {
        setInscripciones(rows);
        setInscripcionesReady(true);
        setDataErrors((prev) => ({ ...prev, inscripciones: null }));
      },
      () => {
        setInscripcionesReady(true);
        setDataErrors((prev) => ({ ...prev, inscripciones: 'No pudimos cargar las inscripciones. Revisa tu conexión o permisos.' }));
      }
    );
    return unsub;
  }, [user, activeActivityId, reconnectTick]);

  // Joins personas + inscripciones into the same flat shape the old
  // participants collection had — SearchTab, ManualTab, StatCards,
  // DistributionBars, report.js, stats.js all keep working unmodified.
  const participants = useMemo(() => {
    const personaMap = new Map(personas.map((p) => [p.id, p]));
    return inscripciones
      .map((i) => {
        const persona = personaMap.get(i.whatsapp);
        if (!persona) return null; // orphaned inscripción (persona doc missing) — skip rather than crash
        return { ...persona, id: i.id, whatsapp: persona.id, categoria: i.categoria, status: i.status, activityId: i.activityId, createdAt: i.createdAt, updatedAt: i.updatedAt };
      })
      .filter(Boolean)
      .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
  }, [personas, inscripciones]);

  const dataError = dataErrors.activities || dataErrors.personas || dataErrors.inscripciones || null;

  const value = useMemo(
    () => ({
      participants,
      personas,
      activities,
      activeActivity,
      activitiesLoading: !activitiesReady,
      loading: !!user && !(personasReady && inscripcionesReady),
      error: dataError,
    }),
    [participants, personas, activities, activeActivity, activitiesReady, personasReady, inscripcionesReady, dataError, user]
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useFirestoreData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useFirestoreData must be used inside <DataProvider>');
  return ctx;
}
