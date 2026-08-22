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

  useEffect(() => {
    const unsub = subscribeActivities((rows) => {
      setActivities(rows);
      setActivitiesReady(true);
    });
    return unsub;
  }, []);

  const activeActivity = useMemo(() => activities.find((a) => a.activa) || null, [activities]);

  useEffect(() => {
    if (!user) {
      setPersonas([]);
      setPersonasReady(false);
      return;
    }
    const unsub = subscribePersonas((rows) => {
      setPersonas(rows);
      setPersonasReady(true);
    });
    return unsub;
  }, [user]);

  // Scoped to whichever activity is active right now — this is what
  // Reception/Admin's day-to-day screens operate on.
  useEffect(() => {
    if (!user || !activeActivity) {
      setInscripciones([]);
      setInscripcionesReady(!activeActivity); // nothing to wait for if there's no active activity
      return;
    }
    setInscripcionesReady(false);
    const unsub = subscribeInscripciones(activeActivity.id, (rows) => {
      setInscripciones(rows);
      setInscripcionesReady(true);
    });
    return unsub;
  }, [user, activeActivity]);

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

  const value = useMemo(
    () => ({
      participants,
      personas,
      activities,
      activeActivity,
      activitiesLoading: !activitiesReady,
      loading: !!user && !(personasReady && inscripcionesReady),
    }),
    [participants, personas, activities, activeActivity, activitiesReady, personasReady, inscripcionesReady, user]
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useFirestoreData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useFirestoreData must be used inside <DataProvider>');
  return ctx;
}
