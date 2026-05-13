// Firestore service with safe fallbacks.
// Uses the firebase web SDK when available; otherwise returns mock data so UI can run.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp as fbServerTimestamp,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { firestore } from './config';

const isFirestoreAvailable = !!firestore;

const toMock = (name, ...args) => {
  console.warn(`[firestoreService] Firestore is not available — returning mock for ${name}`, ...args);
};

export const getDocument = async (collectionName, docId) => {
  if (!isFirestoreAvailable) {
    toMock('getDocument', collectionName, docId);
    return null;
  }
  try {
    const ref = doc(firestore, collectionName, docId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error('[firestoreService] getDocument error', err);
    throw err;
  }
};

export const getCollection = async (collectionName, whereClause = null) => {
  if (!isFirestoreAvailable) {
    toMock('getCollection', collectionName);
    return [];
  }
  try {
    const colRef = collection(firestore, collectionName);
    let q = colRef;
    if (whereClause) q = query(colRef, where(...whereClause));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('[firestoreService] getCollection error', err);
    throw err;
  }
};

export const setDocument = async (collectionName, docId, data) => {
  if (!isFirestoreAvailable) {
    toMock('setDocument', collectionName, docId, data);
    return Promise.resolve();
  }
  try {
    const ref = doc(firestore, collectionName, docId);
    await setDoc(ref, data);
  } catch (err) {
    console.error('[firestoreService] setDocument error', err);
    throw err;
  }
};

export const addDocument = async (collectionName, data) => {
  if (!isFirestoreAvailable) {
    toMock('addDocument', collectionName, data);
    return { id: 'mock-id-' + Date.now() };
  }
  try {
    const ref = await addDoc(collection(firestore, collectionName), data);
    return { id: ref.id };
  } catch (err) {
    console.error('[firestoreService] addDocument error', err);
    throw err;
  }
};

export const updateDocument = async (collectionName, docId, data) => {
  if (!isFirestoreAvailable) {
    toMock('updateDocument', collectionName, docId, data);
    return Promise.resolve();
  }
  try {
    const ref = doc(firestore, collectionName, docId);
    await updateDoc(ref, data);
  } catch (err) {
    console.error('[firestoreService] updateDocument error', err);
    throw err;
  }
};

export const deleteDocument = async (collectionName, docId) => {
  if (!isFirestoreAvailable) {
    toMock('deleteDocument', collectionName, docId);
    return Promise.resolve();
  }
  try {
    const ref = doc(firestore, collectionName, docId);
    await deleteDoc(ref);
  } catch (err) {
    console.error('[firestoreService] deleteDocument error', err);
    throw err;
  }
};

export const queryCollection = async (collectionName, ...queryConstraints) => {
  if (!isFirestoreAvailable) {
    toMock('queryCollection', collectionName, queryConstraints);
    return [];
  }
  try {
    const colRef = collection(firestore, collectionName);
    const q = query(colRef, ...queryConstraints);
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('[firestoreService] queryCollection error', err);
    throw err;
  }
};

/** Max documents Firestore allows in a single limit() call. */
const FIRESTORE_MAX_LIMIT = 1000;

/**
 * Same as queryCollection but caps read size for large collections (cost + memory).
 * Use for unbounded lists where the UI only needs recent / bounded data.
 * @param {string} collectionName
 * @param {number} maxDocs - 1..1000
 * @param {...import('firebase/firestore').QueryConstraint} queryConstraints
 */
export const queryCollectionWithLimit = async (collectionName, maxDocs, ...queryConstraints) => {
  if (!isFirestoreAvailable) {
    toMock('queryCollectionWithLimit', collectionName, queryConstraints);
    return [];
  }
  const cap = Math.min(
    FIRESTORE_MAX_LIMIT,
    Math.max(1, Math.floor(Number(maxDocs) || 500)),
  );
  try {
    const colRef = collection(firestore, collectionName);
    const q = query(colRef, ...queryConstraints, limit(cap));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('[firestoreService] queryCollectionWithLimit error', err);
    throw err;
  }
};

export const serverTimestamp = () => {
  // use Firestore serverTimestamp when available, otherwise use local timestamp
  if (!isFirestoreAvailable) return new Date().toISOString();
  return fbServerTimestamp();
};

