/**
 * Firebase Cloud Functions for DCSE.
 * Deploy: firebase deploy --only functions
 * Requires: firebase.json to include "functions": { "source": "functions" }
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { runAcademicSessionReset } = require('./academicSessionReset');

admin.initializeApp();

const firestore = admin.firestore();
const auth = admin.auth();

/**
 * Wrap reset so uncaught errors are returned with a visible message.
 * Callable code `internal` often hides the message on clients; we use failed-precondition instead.
 */
async function startNewAcademicSessionHandler(data, context) {
  try {
    return await runAcademicSessionReset(data, context);
  } catch (err) {
    if (err instanceof functions.https.HttpsError) {
      const code = String(err.code || '');
      if (code === 'internal' || code === 'functions/internal' || code.endsWith('/internal')) {
        const hint =
          (typeof err.details === 'string' && err.details) ||
          (err.message && err.message !== 'INTERNAL' ? err.message : '') ||
          'The operation failed. Open Firebase Console → Functions → Logs and filter by startNewAcademicSession.';
        throw new functions.https.HttpsError('failed-precondition', `Session reset failed: ${hint}`);
      }
      throw err;
    }
    const msg = (err && err.message) || String(err);
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Session reset failed: ${String(msg).slice(0, 450)}`,
    );
  }
}

/**
 * Full academic session reset: wipes attendance, classes, subjects (incl. assignments),
 * students, teachers, non-admin users docs, push tokens; rotates sessions; revokes and
 * deletes non-admin Firebase Auth users. Callable only (Admin SDK).
 */
exports.startNewAcademicSession = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(startNewAcademicSessionHandler);

/**
 * Student registration: lookup by rollNo (no client Firestore read), create auth user, update student doc.
 * Fixes "Missing or insufficient permissions" because client no longer reads students before auth.
 * Call from client with email, password, name, rollNo, phone; then client signs in with email/password.
 */
exports.registerStudent = functions.https.onCall(async (data, context) => {
  if (context.auth) {
    throw new functions.https.HttpsError('invalid-argument', 'Already signed in. Sign out first to register.');
  }
  const { email, password, name, rollNo, phone } = data || {};
  if (!email || !password || !name || !rollNo) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: email, password, name, rollNo.');
  }
  if (typeof password !== 'string' || password.length < 6) {
    throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters.');
  }

  const studentsSnap = await firestore.collection('students').where('rollNo', '==', String(rollNo).trim()).limit(1).get();
  if (studentsSnap.empty) {
    throw new functions.https.HttpsError('failed-precondition', 'Roll number not found in database. Please contact admin.');
  }
  const studentDoc = studentsSnap.docs[0];
  const studentData = studentDoc.data();
  if (studentData.uid) {
    throw new functions.https.HttpsError('failed-precondition', 'An account already exists for this roll number.');
  }

  const userRecord = await auth.createUser({
    email: email.trim(),
    password,
    displayName: name.trim(),
  });

  const userDocData = {
    name: name.trim(),
    email: email.trim(),
    phone: (phone && String(phone).trim()) || '',
    role: 'student',
    rollNo: String(rollNo).trim(),
    department: 'DCSE',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await firestore.doc(`users/${userRecord.uid}`).set(userDocData);

  await firestore.doc(`students/${studentDoc.id}`).set({
    uid: userRecord.uid,
    email: email.trim(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { uid: userRecord.uid, email: userRecord.email };
});

/**
 * When a new assignment is created, notify enrolled students via Expo Push.
 * Enrolled = students in the subject's class (subject.classId).
 * Uses existing userPushTokens (Expo push tokens). For FCM-only, replace with FCM token lookup and admin.messaging().send().
 */
exports.onAssignmentCreated = functions.firestore
  .document('subjects/{subjectId}/assignments/{assignmentId}')
  .onCreate(async (snap, context) => {
    const { subjectId } = context.params;
    const data = snap.data();
    const assignmentName = data?.assignmentName || 'New assignment';

    const subjectSnap = await admin.firestore().doc(`subjects/${subjectId}`).get();
    if (!subjectSnap.exists) return null;
    const classId = subjectSnap.data()?.classId;
    if (!classId) return null;

    const studentsSnap = await admin.firestore().collection('students').where('classId', '==', classId).get();
    const uids = studentsSnap.docs.map((d) => d.data()?.uid).filter(Boolean);

    const sendPromises = [];
    for (const uid of uids) {
      const tokenSnap = await admin.firestore().doc(`userPushTokens/${uid}`).get();
      const expoToken = tokenSnap.exists ? tokenSnap.data()?.expoPushToken : null;
      if (!expoToken) continue;
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: expoToken,
            title: 'New Assignment Posted',
            body: assignmentName,
            data: { type: 'assignment', subjectId, classId },
          }),
        });
        if (!res.ok) console.warn('Expo push failed for', uid, await res.text());
      } catch (e) {
        console.warn('Expo push error for', uid, e.message);
      }
    }
    return null;
  });
