import React, { createContext, useContext, useState, useEffect } from 'react';
import { enableNetwork, disableNetwork, db } from '../firebase';

interface OfflineSyncContextType {
  isOnline: boolean;
  isFirestoreConnected: boolean;
  isSimulatingOffline: boolean;
  pendingSyncCount: number;
  lastSyncTime: Date | null;
  toggleSimulateOffline: () => Promise<void>;
  forceSync: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextType>({
  isOnline: true,
  isFirestoreConnected: true,
  isSimulatingOffline: false,
  pendingSyncCount: 0,
  lastSyncTime: null,
  toggleSimulateOffline: async () => {},
  forceSync: async () => {},
});

export const useOfflineSync = () => useContext(OfflineSyncContext);

export const OfflineSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean>(true);
  const [isSimulatingOffline, setIsSimulatingOffline] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(new Date());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = async () => {
      setIsOnline(true);
      if (!isSimulatingOffline) {
        try {
          await enableNetwork(db);
          setIsFirestoreConnected(true);
          setLastSyncTime(new Date());
          setPendingSyncCount(0);
        } catch (e) {
          console.warn('Error enabling Firestore network on online event:', e);
        }
      }
    };

    const handleOffline = async () => {
      setIsOnline(false);
      setIsFirestoreConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isSimulatingOffline]);

  const toggleSimulateOffline = async () => {
    try {
      if (isFirestoreConnected) {
        await disableNetwork(db);
        setIsFirestoreConnected(false);
        setIsSimulatingOffline(true);
      } else {
        await enableNetwork(db);
        setIsFirestoreConnected(true);
        setIsSimulatingOffline(false);
        setLastSyncTime(new Date());
      }
    } catch (err) {
      console.error('Error toggling network simulation:', err);
    }
  };

  const forceSync = async () => {
    try {
      await enableNetwork(db);
      setIsFirestoreConnected(true);
      setIsSimulatingOffline(false);
      setLastSyncTime(new Date());
      setPendingSyncCount(0);
    } catch (err) {
      console.error('Error forcing network sync:', err);
    }
  };

  return (
    <OfflineSyncContext.Provider
      value={{
        isOnline: isOnline && isFirestoreConnected,
        isFirestoreConnected,
        isSimulatingOffline,
        pendingSyncCount,
        lastSyncTime,
        toggleSimulateOffline,
        forceSync,
      }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
};
