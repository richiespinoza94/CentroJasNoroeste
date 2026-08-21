import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { subscribeParticipants, subscribeTables, subscribeActivities } from './collections.js';
import { useAuth } from './AuthProvider.jsx';

const DataContext = createContext(null);

// Firestore rules only grant list access on participants/tables to signed-in
// staff, so there's nothing to subscribe to on the public registration page
// — starting those listeners only once a staff user is present avoids a
// permission-denied round-trip on every visitor's phone. `activities` is
// different: it's publicly readable on purpose (the registration form needs
// the active event's name before anyone logs in), so it subscribes
// unconditionally.
export function DataProvider({ children }) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState([]);
  const [tables, setTables] = useState([]);
  const [activities, setActivities] = useState([]);
  const [participantsReady, setParticipantsReady] = useState(false);
  const [tablesReady, setTablesReady] = useState(false);
  const [activitiesReady, setActivitiesReady] = useState(false);

  useEffect(() => {
    const unsub = subscribeActivities((rows) => {
      setActivities(rows);
      setActivitiesReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) {
      setParticipants([]);
      setTables([]);
      setParticipantsReady(false);
      setTablesReady(false);
      return;
    }
    const unsubP = subscribeParticipants((rows) => {
      setParticipants(rows);
      setParticipantsReady(true);
    });
    const unsubT = subscribeTables((rows) => {
      setTables(rows);
      setTablesReady(true);
    });
    return () => {
      unsubP();
      unsubT();
    };
  }, [user]);

  const activeActivity = useMemo(() => activities.find((a) => a.activa) || null, [activities]);

  const value = useMemo(
    () => ({
      participants,
      tables,
      activities,
      activeActivity,
      activitiesLoading: !activitiesReady,
      loading: !!user && !(participantsReady && tablesReady),
    }),
    [participants, tables, activities, activeActivity, activitiesReady, participantsReady, tablesReady, user]
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useFirestoreData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useFirestoreData must be used inside <DataProvider>');
  return ctx;
}
