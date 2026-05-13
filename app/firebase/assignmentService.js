/**
 * Assignment management: subcollections under subjects.
 * Paths: subjects/{subjectId}/assignments/{assignmentId}
 *        subjects/{subjectId}/assignments/{assignmentId}/submissions/{studentId}
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { firestore } from './config';

const isAvailable = !!firestore;

/** @param {string} subjectId
 *  @returns {Promise<Array<{ id: string, assignmentName: string, totalMarks: number, description?: string, dueDate?: string, marksVisible: boolean, createdAt: any }>>}
 */
export async function getAssignments(subjectId) {
  if (!isAvailable || !subjectId) return [];
  const col = collection(firestore, 'subjects', subjectId, 'assignments');
  const snap = await getDocs(col);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * @param {string} subjectId
 * @param {{ assignmentName: string, totalMarks: number, description?: string, dueDate?: string, marksVisible?: boolean }} data
 * @returns {Promise<{ id: string }>}
 */
export async function createAssignment(subjectId, data) {
  if (!isAvailable || !subjectId) throw new Error('Firestore or subjectId missing');
  const { assignmentName, totalMarks, description, dueDate, marksVisible } = data;
  if (!assignmentName || totalMarks == null) throw new Error('assignmentName and totalMarks are required');
  const col = collection(firestore, 'subjects', subjectId, 'assignments');
  const ref = await addDoc(col, {
    assignmentName: assignmentName.trim(),
    totalMarks: Number(totalMarks),
    description: description?.trim() || null,
    dueDate: dueDate || null,
    marksVisible: marksVisible === true,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}

/**
 * @param {string} subjectId
 * @param {string} assignmentId
 * @param {{ assignmentName?: string, totalMarks?: number, description?: string, dueDate?: string, marksVisible?: boolean }} data
 */
export async function updateAssignment(subjectId, assignmentId, data) {
  if (!isAvailable || !subjectId || !assignmentId) throw new Error('Missing subjectId or assignmentId');
  const ref = doc(firestore, 'subjects', subjectId, 'assignments', assignmentId);
  const update = {};
  if (data.assignmentName !== undefined) update.assignmentName = data.assignmentName.trim();
  if (data.totalMarks !== undefined) update.totalMarks = Number(data.totalMarks);
  if (data.description !== undefined) update.description = data.description?.trim() || null;
  if (data.dueDate !== undefined) update.dueDate = data.dueDate || null;
  if (data.marksVisible !== undefined) update.marksVisible = data.marksVisible === true;
  if (Object.keys(update).length === 0) return;
  await updateDoc(ref, update);
}

/**
 * Delete assignment and all its submissions.
 * @param {string} subjectId
 * @param {string} assignmentId
 */
export async function deleteAssignment(subjectId, assignmentId) {
  if (!isAvailable || !subjectId || !assignmentId) throw new Error('Missing subjectId or assignmentId');
  const submissionsCol = collection(firestore, 'subjects', subjectId, 'assignments', assignmentId, 'submissions');
  const snap = await getDocs(submissionsCol);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  const assignmentRef = doc(firestore, 'subjects', subjectId, 'assignments', assignmentId);
  await deleteDoc(assignmentRef);
}

/**
 * @param {string} subjectId
 * @param {string} assignmentId
 * @returns {Promise<Array<{ id: string, marksObtained?: number, evaluatedAt: any, evaluatedBy?: string }>>}
 */
export async function getSubmissions(subjectId, assignmentId) {
  if (!isAvailable || !subjectId || !assignmentId) return [];
  const col = collection(firestore, 'subjects', subjectId, 'assignments', assignmentId, 'submissions');
  const snap = await getDocs(col);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Pick this student's submission from a list (doc id is auth uid and/or students/{id} roster id).
 * @param {Array<{ id: string, marksObtained?: number }>} submissions
 * @param {{ uid?: string, id?: string }} studentRow
 * @param {string} authUid
 * @returns {{ id: string, marksObtained?: number } | null}
 */
export function pickSubmissionForStudent(submissions, studentRow, authUid) {
  if (!submissions?.length) return null;
  const ids = new Set([authUid, studentRow?.uid, studentRow?.id].filter(Boolean));
  return submissions.find((s) => ids.has(s.id)) || null;
}

/**
 * Get one student's submission (for student view).
 * @param {string} subjectId
 * @param {string} assignmentId
 * @param {string} studentId - Firestore document id of student or uid
 */
export async function getSubmission(subjectId, assignmentId, studentId) {
  if (!isAvailable || !subjectId || !assignmentId || !studentId) return null;
  const ref = doc(firestore, 'subjects', subjectId, 'assignments', assignmentId, 'submissions', studentId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Set or overwrite marks for a student. Teacher only.
 * @param {string} subjectId
 * @param {string} assignmentId
 * @param {string} studentId - document id in students collection (or uid if you use uid as submission doc id)
 * @param {{ marksObtained: number, evaluatedBy: string }} data
 */
export async function setSubmission(subjectId, assignmentId, studentId, data) {
  if (!isAvailable || !subjectId || !assignmentId || !studentId) throw new Error('Missing required params');
  const ref = doc(firestore, 'subjects', subjectId, 'assignments', assignmentId, 'submissions', studentId);
  await setDoc(ref, {
    marksObtained: Number(data.marksObtained),
    evaluatedAt: serverTimestamp(),
    evaluatedBy: data.evaluatedBy || null,
  }, { merge: true });
}
