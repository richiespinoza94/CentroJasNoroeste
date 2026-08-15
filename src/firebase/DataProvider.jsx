import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { subscribeParticipants, subscribeTables } from './collections.js';
import { useAuth } from './AuthProvider.jsx';

const DataContext = createContext(null);

// Firestore rules only grant list access on participants/tables to signed-in
// staff, so there's nothing to subscribe to on the public registration page
// — starting the listeners only once a staff user is present avoids a
// permission-denied round-trip on every visitor's phone.
export function DataProvider({ children }) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState([]);
  const [tables, setTables] = useState([]);
  const [participantsReady, setParticipantsReady] = useState(false);
  const [tablesReady, setTablesReady] = useState(false);

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

  const value = useMemo(
    () => ({ participants, tables, loading: !!user && !(participantsReady && tablesReady) }),
    [participants, tables, participantsReady, tablesReady, user]
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useFirestoreData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useFirestoreData must be used inside <DataProvider>');
  return ctx;
}
