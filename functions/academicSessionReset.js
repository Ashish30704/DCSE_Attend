/**
 * Full academic session reset (Cloud Function + Admin SDK).
 * Firestore cannot delete whole collections in a single transaction; we use:
 * - One transaction for the distributed lock only
 * - Batched deletes (<= 500 ops per batch) for all other work
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions');

const BATCH_SIZE = 450;
const LOCK_PATH = 'system/academicResetLock';
const STALE_LOCK_MS = 60 * 60 * 1000; // reclaim if a previous run crashed

const REQUIRED_PHRASE = 'START NEW SESSION';

function getDb() {
  return admin.firestore();
}

function getAuth() {
  return admin.auth();
}

async function commitBatchDeletes(docRefs) {
  if (!docRefs || docRefs.length === 0) return;
  const db = getDb();
  for (let i = 0; i < docRefs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    docRefs.slice(i, i + BATCH_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

/**
 * Delete all docs in a root collection (stable pagination via __name__).
 * @returns {Promise<number>} approximate number of documents deleted
 */
async function deleteRootCollection(collectionId) {
  const db = getDb();
  const col = db.collection(collectionId);
  let deleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await col.orderBy('__name__').limit(BATCH_SIZE).get();
    if (snap.empty) break;
    deleted += snap.size;
    await commitBatchDeletes(snap.docs.map((d) => d.ref));
  }
  return deleted;
}

function toHttpsErrorMessage(err) {
  if (!err) return 'Unknown error';
  if (typeof err.message === 'string' && err.message.trim()) return err.message.trim().slice(0, 500);
  return String(err).slice(0, 500);
}

function isHttpsError(err) {
  return err && typeof err.code === 'string' && err.code.startsWith('functions/');
}

/** Delete all submissions for one assignment (paginated). */
async function deleteSubmissionsForAssignment(assignmentRef) {
  const col = assignmentRef.collection('submissions');
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await col.orderBy('__name__').limit(BATCH_SIZE).get();
    if (snap.empty) break;
    await commitBatchDeletes(snap.docs.map((d) => d.ref));
  }
}

/** Delete assignments (and nested submissions), then subject root doc. */
async function deleteSubjectTree(subjectId) {
  const db = getDb();
  const subjectRef = db.collection('subjects').doc(subjectId);
  const acol = subjectRef.collection('assignments');
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const assignmentsSnap = await acol.orderBy('__name__').limit(BATCH_SIZE).get();
    if (assignmentsSnap.empty) break;
    for (const assignDoc of assignmentsSnap.docs) {
      await deleteSubmissionsForAssignment(assignDoc.ref);
      await assignDoc.ref.delete();
    }
  }
  await subjectRef.delete();
}

async function deleteAllSubjects() {
  const db = getDb();
  let deletedSubjects = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const subjectsSnap = await db.collection('subjects').orderBy('__name__').limit(BATCH_SIZE).get();
    if (subjectsSnap.empty) break;
    for (const doc of subjectsSnap.docs) {
      await deleteSubjectTree(doc.id);
      deletedSubjects += 1;
    }
  }
  return deletedSubjects;
}

/** Optional: copy minimal summary before wipe. */
async function writeArchiveSummary(db, payload) {
  const ref = db.collection('sessionArchives').doc();
  await ref.set({
    ...payload,
    archivedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function maybeDeleteOptionalCollections() {
  const optional = [
    'leaves',
    'leaveRequests',
    'attendanceSummaries',
    'analytics',
    'notifications',
    'studentNotifications',
  ];
  const db = getDb();
  for (const name of optional) {
    try {
      const snap = await db.collection(name).limit(1).get();
      if (!snap.empty) await deleteRootCollection(name);
    } catch (_) {
      /* collection may not exist */
    }
  }
}

async function deactivateAllSessions(db) {
  const snap = await db.collection('sessions').get();
  if (snap.empty) return;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    docs.slice(i, i + BATCH_SIZE).forEach((d) => {
      batch.set(
        d.ref,
        {
          isActive: false,
          deactivatedByReset: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    await batch.commit();
  }
}

async function createNewSession(db, newSessionName, adminUid) {
  const name =
    (newSessionName && String(newSessionName).trim()) ||
    `Session ${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
  const startDate = new Date().toISOString().split('T')[0];
  const ref = db.collection('sessions').doc();
  await ref.set({
    name,
    startDate,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: adminUid,
    createdAfterFullReset: true,
  });
  return { id: ref.id, name, startDate };
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<string[]>}
 */
async function collectAdminUids(db) {
  const usersSnap = await db.collection('users').get();
  const adminUids = [];
  usersSnap.forEach((d) => {
    const role = d.data()?.role;
    const isAdmin = role && String(role).toLowerCase() === 'admin';
    if (isAdmin || d.data()?.isSuperAdmin === true) {
      adminUids.push(d.id);
    }
  });
  return adminUids;
}

async function deleteNonAdminUsers(db, adminUidSet) {
  const usersSnap = await db.collection('users').get();
  const toDelete = usersSnap.docs.filter((d) => !adminUidSet.has(d.id));
  await commitBatchDeletes(toDelete.map((d) => d.ref));
}

async function deleteAllPushTokens(db) {
  try {
    await deleteRootCollection('userPushTokens');
  } catch (e) {
    functions.logger.warn('userPushTokens delete skipped or partial', e.message);
  }
}

async function purgeNonAdminAuthUsers(adminUidSet, log) {
  const auth = getAuth();
  let nextPageToken;
  let revoked = 0;
  let deleted = 0;
  let errors = 0;
  do {
    const page = await auth.listUsers(1000, nextPageToken);
    for (const userRecord of page.users) {
      if (adminUidSet.has(userRecord.uid)) continue;
      try {
        await auth.revokeRefreshTokens(userRecord.uid);
        revoked += 1;
      } catch (e) {
        log.warn('revokeRefreshTokens failed', userRecord.uid, e.message);
        errors += 1;
      }
      try {
        await auth.deleteUser(userRecord.uid);
        deleted += 1;
      } catch (e) {
        log.warn('deleteUser failed', userRecord.uid, e.message);
        errors += 1;
      }
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);
  return { revoked, deleted, errors };
}

async function acquireLock(db, uid) {
  const lockRef = db.doc(LOCK_PATH);
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(lockRef);
    const data = snap.exists ? snap.data() : {};
    if (data.inProgress === true && typeof data.startedAtMs === 'number') {
      const age = now - data.startedAtMs;
      if (age < STALE_LOCK_MS) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'A session reset is already in progress. Wait for it to finish or try again after one hour if it failed.',
        );
      }
    }
    tx.set(lockRef, {
      inProgress: true,
      startedAtMs: now,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      byUid: uid,
    });
  });
}

async function releaseLock(db) {
  const lockRef = db.doc(LOCK_PATH);
  await lockRef.set(
    {
      inProgress: false,
      finishedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Callable handler (v1 onCall signature).
 */
async function runAcademicSessionReset(data, context) {
  const log = functions.logger;
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in as admin to run this action.');
  }

  const callerUid = context.auth.uid;
  const db = getDb();

  const userSnap = await db.doc(`users/${callerUid}`).get();
  const callerRole = userSnap.data()?.role;
  if (!userSnap.exists || String(callerRole || '').toLowerCase() !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can start a new academic session.');
  }

  const newSessionName = data?.newSessionName;
  const confirmPhrase = data?.confirmPhrase;
  const acknowledgeIrreversible = data?.acknowledgeIrreversible === true;
  const archiveSummary = data?.archiveSummary === true;

  if (!newSessionName || !String(newSessionName).trim()) {
    throw new functions.https.HttpsError('invalid-argument', 'newSessionName is required.');
  }
  if (confirmPhrase !== REQUIRED_PHRASE) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Confirmation phrase must be exactly: ${REQUIRED_PHRASE}`,
    );
  }
  if (!acknowledgeIrreversible) {
    throw new functions.https.HttpsError('invalid-argument', 'You must acknowledge that this action cannot be undone.');
  }

  await acquireLock(db, callerUid);

  const summary = {
    attendanceDeleted: 0,
    classesDeleted: 0,
    studentsDeleted: 0,
    teachersDeleted: 0,
    subjectsDeleted: 0,
    usersDeleted: 0,
  };

  try {
    const adminUids = await collectAdminUids(db);
    const adminUidSet = new Set(adminUids);
    if (!adminUidSet.has(callerUid)) {
      throw new functions.https.HttpsError('failed-precondition', 'Caller is not listed as admin in users collection.');
    }

    if (archiveSummary) {
      try {
        const previousCounts = {};
        for (const coll of ['attendance', 'students', 'teachers', 'classes', 'subjects']) {
          try {
            const c = db.collection(coll);
            if (typeof c.count === 'function') {
              const agg = await c.count().get();
              previousCounts[coll] = agg.data().count;
            } else {
              const q = await c.limit(5000).get();
              previousCounts[coll] = q.size >= 5000 ? '5000+' : q.size;
            }
          } catch (e) {
            log.warn('archive count failed for', coll, e.message);
            previousCounts[coll] = null;
          }
        }
        await writeArchiveSummary(db, {
          label: 'pre-reset snapshot',
          previousCounts,
          performedByUid: callerUid,
          newSessionName: String(newSessionName).trim(),
        });
      } catch (e) {
        log.warn('archive summary skipped', e.message);
      }
    }

    // 1 — Attendance (counts from actual deletes — avoids aggregate count API issues)
    summary.attendanceDeleted = await deleteRootCollection('attendance');

    // 2 — Subjects tree (assignments + submissions)
    summary.subjectsDeleted = await deleteAllSubjects();

    // 3 — Classes
    summary.classesDeleted = await deleteRootCollection('classes');

    // 4 — Students & teachers roster
    summary.studentsDeleted = await deleteRootCollection('students');
    summary.teachersDeleted = await deleteRootCollection('teachers');

    await maybeDeleteOptionalCollections();

    // 5 — Users (Firestore): keep only admins / super-admins
    const usersBefore = await db.collection('users').get();
    summary.usersDeleted = usersBefore.docs.filter((d) => !adminUidSet.has(d.id)).length;
    await deleteNonAdminUsers(db, adminUidSet);

    // 6 — Push tokens (device login state)
    await deleteAllPushTokens(db);

    // 7 — Sessions: deactivate all, then create new active session
    await deactivateAllSessions(db);
    const newSession = await createNewSession(db, newSessionName, callerUid);

    // 8 — Auth: revoke + delete non-admin Firebase Auth accounts
    let authResult;
    try {
      authResult = await purgeNonAdminAuthUsers(adminUidSet, log);
    } catch (authErr) {
      log.error('purgeNonAdminAuthUsers failed', authErr);
      authResult = {
        revoked: 0,
        deleted: 0,
        errors: 1,
        topLevelError: toHttpsErrorMessage(authErr),
      };
    }

    // 9 — Audit log (no client access via rules)
    try {
      await db.collection('auditLogs').add({
        type: 'ACADEMIC_SESSION_FULL_RESET',
        performedByUid: callerUid,
        performedAt: admin.firestore.FieldValue.serverTimestamp(),
        newSessionId: newSession.id,
        newSessionName: newSession.name,
        summary,
        auth: authResult,
      });
    } catch (auditErr) {
      log.error('auditLogs.add failed', auditErr);
    }

    return {
      ok: true,
      newSession,
      summary,
      auth: authResult,
      message:
        'Academic session reset completed. All non-admin data was removed, sessions were rotated, and non-admin Auth users were deleted. Re-create teachers/students and have them register again.',
    };
  } catch (e) {
    log.error('academicSessionReset failed', e);
    if (e instanceof functions.https.HttpsError) throw e;
    if (isHttpsError(e)) throw e;
    const msg = toHttpsErrorMessage(e);
    log.error('academicSessionReset error detail', msg);
    // Do not use code "internal" — Firebase clients hide custom messages for functions/internal.
    throw new functions.https.HttpsError(
      'failed-precondition',
      msg ? `Session reset failed: ${msg}` : 'Session reset failed. Check Cloud Function logs.',
    );
  } finally {
    try {
      await releaseLock(db);
    } catch (lockErr) {
      log.error('releaseLock failed', lockErr);
    }
  }
}

module.exports = {
  runAcademicSessionReset,
  REQUIRED_PHRASE,
};
