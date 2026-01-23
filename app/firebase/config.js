import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  getReactNativePersistence,
  initializeAuth
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyDmTWCWgVOmnutFve6SkNKZQOAtRKv_d-I',
  authDomain: 'dcse-cdlu.firebaseapp.com',
  projectId: 'dcse-cdlu',
  storageBucket: 'dcse-cdlu.appspot.com',
  messagingSenderId: '434795812297',
  appId: '1:434795812297:android:9de6948e3cf27afc084418',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Platform-specific auth initialization with persistence
let auth;
if (Platform.OS === 'web') {
  // Web: Use browserLocalPersistence (localStorage) for web reload safety
  try {
    auth = initializeAuth(app, {
      persistence: browserLocalPersistence,
    });
  } catch (err) {
    // Already initialized, get existing instance
    auth = getAuth(app);
  }
} else {
  // React Native: Use AsyncStorage for persistence
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (err) {
    // Already initialized, get existing instance
    auth = getAuth(app);
  }
}

export { auth };

// Initialize Firestore with offline persistence for web reload safety
let _firestore = null;
try {
  if (Platform.OS === 'web') {
    // Web: Use persistent local cache with multi-tab support
    // This enables IndexedDB persistence which survives page reloads
    _firestore = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
    console.log('[firebase/config] Firestore initialized with multi-tab IndexedDB persistence for web');
  } else {
    // React Native: Use persistent local cache
    _firestore = initializeFirestore(app, {
      localCache: persistentLocalCache(),
    });
    console.log('[firebase/config] Firestore initialized with native persistence');
  }
} catch (err) {
  console.warn('[firebase/config] Could not initialize Firestore with persistence, falling back to default:', err.message || err);
  try {
    // Fallback to default Firestore (no offline persistence)
    _firestore = getFirestore(app);
    console.warn('[firebase/config] Using default Firestore without offline persistence');
  } catch (fallbackErr) {
    console.error('[firebase/config] Could not initialize Firestore:', fallbackErr.message || fallbackErr);
    _firestore = null;
  }
}

export const firestore = _firestore;

export default app;

