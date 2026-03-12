import { createUserWithEmailAndPassword, deleteUser, onAuthStateChanged as firebaseOnAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { addDoc, collection, doc, serverTimestamp as fbServerTimestamp, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import app, { auth, firestore } from './config';

const isFirestoreAvailable = !!firestore;

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    const authUser = userCredential.user;
    const base = { uid: authUser.uid, email: authUser.email, emailVerified: authUser.emailVerified };

    if (isFirestoreAvailable) {
      try {
        const userDoc = await getDoc(doc(firestore, 'users', authUser.uid));
        if (userDoc.exists()) {
          return { ...base, ...userDoc.data() };
        }
      } catch (err) {
        console.warn('[authService] loginUser: could not fetch user document', err);
      }
    }

    return base;
  } catch (error) {
    console.error('[authService] loginUser error', error);
    throw error;
  }
};

export const registerUser = async (email, password, userData) => {
  try {
    // Student registration (no Cloud Functions — works on free Firebase plan)
    // 1. Create Auth user first so we are authenticated for Firestore.
    // 2. Query students by rollNo (read allowed for any authenticated user).
    // 3. Write users/{uid} and update student doc with uid/email (update allowed when doc.uid is null and we set uid to request.auth.uid).
    if (userData.role === 'student') {
      if (!userData.rollNo) {
        throw new Error('Roll number is required for student registration');
      }
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = userCredential.user.uid;
      // Ensure Firestore picks up the new auth token before any reads/writes
      await new Promise((r) => setTimeout(r, 300));
      if (isFirestoreAvailable) {
        try {
          const studentsQuery = query(
            collection(firestore, 'students'),
            where('rollNo', '==', String(userData.rollNo).trim())
          );
          const studentsSnapshot = await getDocs(studentsQuery);
          if (studentsSnapshot.empty) {
            await deleteUser(userCredential.user);
            throw new Error('Roll number not found in database. Please contact admin.');
          }
          const studentDoc = studentsSnapshot.docs[0];
          const existing = studentDoc.data();
          if (existing.uid) {
            await deleteUser(userCredential.user);
            throw new Error('An account already exists for this roll number.');
          }
          const userDocData = {
            name: userData.name,
            email: email.trim(),
            phone: userData.phone || '',
            role: 'student',
            rollNo: userData.rollNo,
            department: userData.department || 'DCSE',
            createdAt: fbServerTimestamp(),
          };
          await setDoc(doc(firestore, 'users', uid), userDocData);
          await setDoc(
            doc(firestore, 'students', studentDoc.id),
            { uid, email: email.trim(), updatedAt: fbServerTimestamp() },
            { merge: true }
          );
        } catch (err) {
          if (err.message?.includes('Roll number') || err.message?.includes('already exists')) throw err;
          try {
            await deleteUser(userCredential.user);
          } catch (_) {}
          throw err;
        }
      }
      const userDoc = isFirestoreAvailable ? await getDoc(doc(firestore, 'users', uid)) : null;
      const profile = userDoc?.exists() ? userDoc.data() : {};
      return {
        uid,
        email: userCredential.user.email,
        emailVerified: userCredential.user.emailVerified,
        ...profile,
      };
    }

    // Teacher registration (no extra permissions — create user first, then query teachers while authenticated)
    if (userData.role === 'teacher') {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = userCredential.user.uid;
      await new Promise((r) => setTimeout(r, 300));
      if (isFirestoreAvailable) {
        try {
          const teachersQuery = query(
            collection(firestore, 'teachers'),
            where('email', '==', email.trim())
          );
          const teachersSnapshot = await getDocs(teachersQuery);
          if (teachersSnapshot.empty) {
            await deleteUser(userCredential.user);
            throw new Error('Email not found in teachers list. Please contact admin to add you first.');
          }
          const teacherDoc = teachersSnapshot.docs[0];
          const existing = teacherDoc.data();
          if (existing.uid) {
            await deleteUser(userCredential.user);
            throw new Error('An account already exists for this email.');
          }
          const userDocData = {
            name: userData.name,
            email: email.trim(),
            phone: userData.phone || '',
            role: 'teacher',
            department: userData.department || 'DCSE',
            createdAt: fbServerTimestamp(),
          };
          await setDoc(doc(firestore, 'users', uid), userDocData);
          await setDoc(
            doc(firestore, 'teachers', teacherDoc.id),
            { uid, email: email.trim(), updatedAt: fbServerTimestamp() },
            { merge: true }
          );
        } catch (err) {
          if (err.message?.includes('Email not found') || err.message?.includes('already exists')) throw err;
          try {
            await deleteUser(userCredential.user);
          } catch (_) {}
          throw err;
        }
      }
      const userDoc = isFirestoreAvailable ? await getDoc(doc(firestore, 'users', uid)) : null;
      const profile = userDoc?.exists() ? userDoc.data() : {};
      return {
        uid,
        email: userCredential.user.email,
        emailVerified: userCredential.user.emailVerified,
        ...profile,
      };
    }

    // Admin registration — create user first, then write users + admins (any authenticated user can add to admins for self-registration)
    if (userData.role === 'admin') {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = userCredential.user.uid;
      await new Promise((r) => setTimeout(r, 300));
      if (isFirestoreAvailable) {
        try {
          await setDoc(doc(firestore, 'users', uid), {
            name: userData.name,
            email: email.trim(),
            phone: userData.phone || '',
            role: 'admin',
            department: userData.department || 'DCSE',
            createdAt: fbServerTimestamp(),
          });
          await addDoc(collection(firestore, 'admins'), {
            uid,
            name: userData.name,
            email: email.trim(),
            phone: userData.phone || '',
            department: userData.department || 'DCSE',
            createdAt: fbServerTimestamp(),
          });
        } catch (err) {
          try {
            await deleteUser(userCredential.user);
          } catch (_) {}
          throw err;
        }
      }
      const userDoc = isFirestoreAvailable ? await getDoc(doc(firestore, 'users', uid)) : null;
      const profile = userDoc?.exists() ? userDoc.data() : {};
      return {
        uid,
        email: userCredential.user.email,
        emailVerified: userCredential.user.emailVerified,
        ...profile,
      };
    }

    return null;
  } catch (error) {
    console.error('[authService] registerUser error', error);
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
};

export const getCurrentUser = () => {
  return auth.currentUser;
};

export const onAuthStateChanged = (callback) => {
  return firebaseOnAuthStateChanged(auth, callback);
};

/** Send password reset email (forgot password). Firebase sends the email; user gets a link in inbox. */
export const sendPasswordReset = async (email) => {
  if (!email || !email.trim()) {
    throw new Error('Please enter your email address.');
  }
  await sendPasswordResetEmail(auth, email.trim());
};

/** Resend email verification link to the current user (for verify-email screen). */
export const resendVerificationEmail = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in to resend the verification email.');
  if (user.emailVerified) throw new Error('Your email is already verified.');
  await sendEmailVerification(user);
};

/** Reload current user from Firebase (e.g. after user clicked verification link). */
export const reloadAuthUser = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  await user.reload();
  return auth.currentUser;
};

