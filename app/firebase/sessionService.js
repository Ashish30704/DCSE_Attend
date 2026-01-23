// Session management service for handling academic sessions
import { collection, doc, getDoc, getDocs, query, setDoc, where, serverTimestamp } from 'firebase/firestore';
import { firestore } from './config';

const isFirestoreAvailable = !!firestore;

// Get current active session
export const getCurrentSession = async () => {
  if (!isFirestoreAvailable) {
    console.warn('[sessionService] Firestore not available, returning mock session');
    return { id: 'mock-session', name: '2024-2025', isActive: true };
  }

  try {
    const sessionsQuery = query(
      collection(firestore, 'sessions'),
      where('isActive', '==', true)
    );
    const sessionsSnapshot = await getDocs(sessionsQuery);
    
    if (sessionsSnapshot.empty) {
      // Create default session if none exists
      const defaultSession = {
        name: '2024-2025',
        startDate: new Date().toISOString().split('T')[0],
        isActive: true,
        createdAt: serverTimestamp(),
      };
      const sessionRef = doc(collection(firestore, 'sessions'));
      await setDoc(sessionRef, defaultSession);
      return { id: sessionRef.id, ...defaultSession };
    }

    const sessionDoc = sessionsSnapshot.docs[0];
    return { id: sessionDoc.id, ...sessionDoc.data() };
  } catch (error) {
    console.error('[sessionService] getCurrentSession error', error);
    throw error;
  }
};

// Get all sessions
export const getAllSessions = async () => {
  if (!isFirestoreAvailable) {
    return [];
  }

  try {
    const sessionsSnapshot = await getDocs(collection(firestore, 'sessions'));
    return sessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('[sessionService] getAllSessions error', error);
    throw error;
  }
};

// Reset session - archive current and create new
export const resetSession = async (newSessionName, adminUid) => {
  if (!isFirestoreAvailable) {
    console.warn('[sessionService] Firestore not available, cannot reset session');
    return null;
  }

  try {
    // Get current active session
    const currentSession = await getCurrentSession();
    
    if (!currentSession.id) {
      throw new Error('No active session found');
    }

    // Archive current session
    await setDoc(
      doc(firestore, 'sessions', currentSession.id),
      {
        isActive: false,
        archivedAt: serverTimestamp(),
        archivedBy: adminUid,
      },
      { merge: true }
    );

    // Create new session
    const newSession = {
      name: newSessionName || `Session ${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      startDate: new Date().toISOString().split('T')[0],
      isActive: true,
      createdAt: serverTimestamp(),
      createdBy: adminUid,
    };

    const sessionRef = doc(collection(firestore, 'sessions'));
    await setDoc(sessionRef, newSession);

    return { id: sessionRef.id, ...newSession };
  } catch (error) {
    console.error('[sessionService] resetSession error', error);
    throw error;
  }
};

// Get session by ID
export const getSessionById = async (sessionId) => {
  if (!isFirestoreAvailable) {
    return null;
  }

  try {
    const sessionDoc = await getDoc(doc(firestore, 'sessions', sessionId));
    if (sessionDoc.exists()) {
      return { id: sessionDoc.id, ...sessionDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('[sessionService] getSessionById error', error);
    throw error;
  }
};
