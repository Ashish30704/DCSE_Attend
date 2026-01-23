import { createUserWithEmailAndPassword, onAuthStateChanged as firebaseOnAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { addDoc, collection, doc, serverTimestamp as fbServerTimestamp, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { auth, firestore } from './config';

const isFirestoreAvailable = !!firestore;

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    // If Firestore is available, try to fetch additional user data, otherwise return minimal auth info
    if (isFirestoreAvailable) {
      try {
        const userDoc = await getDoc(doc(firestore, 'users', userCredential.user.uid));
        if (userDoc.exists()) {
          return { uid: userCredential.user.uid, email: userCredential.user.email, ...userDoc.data() };
        }
      } catch (err) {
        console.warn('[authService] loginUser: could not fetch user document', err);
      }
    }

    return { uid: userCredential.user.uid, email: userCredential.user.email };
  } catch (error) {
    console.error('[authService] loginUser error', error);
    throw error;
  }
};

export const registerUser = async (email, password, userData) => {
  try {
    // For students, validate roll number exists in database
    if (userData.role === 'student') {
      if (!userData.rollNo) {
        throw new Error('Roll number is required for student registration');
      }

      if (isFirestoreAvailable) {
        // Check if roll number exists in students collection
        const studentsQuery = query(
          collection(firestore, 'students'),
          where('rollNo', '==', userData.rollNo)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        
        if (studentsSnapshot.empty) {
          throw new Error('Roll number not found in database. Please contact admin.');
        }

        const studentDoc = studentsSnapshot.docs[0].data();
        // Check if student already has an account
        if (studentDoc.uid) {
          throw new Error('An account already exists for this roll number.');
        }

        // Update student document with uid after creating auth account
        userData.studentDocId = studentsSnapshot.docs[0].id;
      }
    }
    
    // For teachers, validate teacher ID exists in database
    if (userData.role === 'teacher') {
      if (!userData.id) {
        throw new Error('Teacher ID is required for teacher registration');
      }

      if (isFirestoreAvailable) {
        // Check if teacher ID exists in teachers collection
        const teachersQuery = query(
          collection(firestore, 'teachers'),
          where('id', '==', userData.id)
        );
        const teachersSnapshot = await getDocs(teachersQuery);
        
        if (teachersSnapshot.empty) {
          throw new Error('Teacher ID not found in database. Please contact admin.');
        }

        const teacherDoc = teachersSnapshot.docs[0].data();
        // Check if teacher already has an account
        if (teacherDoc.uid) {
          throw new Error('An account already exists for this teacher ID.');
        }

        // Store teacher document ID to update after creating auth account
        userData.teacherDocId = teachersSnapshot.docs[0].id;
      }
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    const result = { uid: userCredential.user.uid, email: userCredential.user.email, ...userData };

    if (isFirestoreAvailable) {
      try {
        // Build userDocData without undefined values (Firestore doesn't allow undefined)
        const userDocData = {
          name: userData.name,
          email,
          phone: userData.phone || '',
          role: userData.role,
          department: userData.department || 'DCSE',
          createdAt: fbServerTimestamp(),
        };
        
        // Only include id if it exists (for teachers/admins)
        if (userData.id) {
          userDocData.id = userData.id;
        }
        
        // Only include rollNo if it exists (for students)
        if (userData.rollNo) {
          userDocData.rollNo = userData.rollNo;
        }
        
        await setDoc(doc(firestore, 'users', userCredential.user.uid), userDocData);

        if (userData.role === 'teacher') {
          // Update existing teacher document with uid and email
          if (userData.teacherDocId) {
            await setDoc(
              doc(firestore, 'teachers', userData.teacherDocId),
              { 
                uid: userCredential.user.uid, 
                email: email,
                updatedAt: fbServerTimestamp()
              },
              { merge: true }
            );
          } else {
            // Fallback: create new teacher document if not found (shouldn't happen)
            await addDoc(collection(firestore, 'teachers'), {
              uid: userCredential.user.uid,
              name: userData.name,
              id: userData.id,
              email,
              phone: userData.phone || '',
              department: userData.department || 'DCSE',
              createdAt: fbServerTimestamp(),
            });
          }
        } else if (userData.role === 'admin') {
          await addDoc(collection(firestore, 'admins'), {
            uid: userCredential.user.uid,
            name: userData.name,
            id: userData.id,
            email,
            phone: userData.phone || '',
            department: userData.department || 'DCSE',
            createdAt: fbServerTimestamp(),
          });
        } else if (userData.role === 'student') {
          // Update existing student document with uid and email
          if (userData.studentDocId) {
            await setDoc(
              doc(firestore, 'students', userData.studentDocId),
              { 
                uid: userCredential.user.uid, 
                email: email,
                updatedAt: fbServerTimestamp()
              },
              { merge: true }
            );
          }
        }
      } catch (err) {
        console.warn('[authService] registerUser: could not write user data to Firestore', err);
        throw err;
      }
    }

    return result;
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

