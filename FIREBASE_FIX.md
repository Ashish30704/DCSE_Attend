# Firebase Migration Fix

## Problem
The error "Native module RNFBAppModule not found" occurred because the code was using React Native Firebase (`@react-native-firebase`) which requires native modules that don't work with Expo Go.

## Solution
Migrated from React Native Firebase to Firebase Web SDK (`firebase` package) which works perfectly with Expo.

## Changes Made

### 1. Firebase Configuration (`app/firebase/config.js`)
- Changed from `@react-native-firebase/auth` and `@react-native-firebase/firestore`
- To `firebase/app`, `firebase/auth`, and `firebase/firestore`

### 2. Created Firestore Service Helper (`app/firebase/firestoreService.js`)
- Helper functions to simplify Firestore operations
- Functions: `getDocument`, `getCollection`, `addDocument`, `updateDocument`, `deleteDocument`, `queryCollection`

### 3. Updated Authentication Service (`app/firebase/authService.js`)
- Changed from `auth().signInWithEmailAndPassword()` to `signInWithEmailAndPassword(auth, email, password)`
- Changed from `firestore().collection()` to using Firestore Web SDK functions

### 4. Updated All Screen Files
- **app/index.tsx**: Updated to use `getDocument` helper
- **app/clerk/dashboard.tsx**: Updated to use `getCollection`
- **app/clerk/teachers.tsx**: Updated all Firestore operations
- **app/clerk/classes.tsx**: Updated all Firestore operations
- **app/clerk/subjects.tsx**: Updated all Firestore operations
- **app/clerk/class-students.tsx**: Updated all Firestore operations
- **app/teacher/dashboard.tsx**: Updated to use `queryCollection` with `where` clauses
- **app/teacher/attendance.tsx**: Updated all Firestore operations

## Key Differences

### React Native Firebase (Old)
```javascript
firestore().collection('users').doc(uid).get()
firestore().collection('users').add({ data })
firestore().FieldValue.serverTimestamp()
```

### Firebase Web SDK (New)
```javascript
getDoc(doc(firestore, 'users', uid))
addDoc(collection(firestore, 'users'), { data })
serverTimestamp()
```

## Testing
1. The app should now work with Expo Go
2. All Firebase operations should function correctly
3. No native module errors should occur

## Note
The `@react-native-firebase` packages are still in `package.json` and `app.json` but are no longer used. They can be removed if desired, but leaving them won't cause issues.

