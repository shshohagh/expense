import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore,
  Firestore,
  enableNetwork,
  disableNetwork
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const databaseId = (firebaseConfig as any).firestoreDatabaseId || '(default)';

// Initialize Firestore with robust multi-tab IndexedDB offline persistence
let firestoreDb: Firestore;
if (typeof window !== 'undefined') {
  try {
    firestoreDb = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    }, databaseId);
  } catch (err) {
    // Fallback if already initialized (e.g. Vite HMR)
    firestoreDb = getFirestore(app, databaseId);
  }
} else {
  firestoreDb = getFirestore(app, databaseId);
}

export const db = firestoreDb;
export { enableNetwork, disableNetwork };
export default app;
