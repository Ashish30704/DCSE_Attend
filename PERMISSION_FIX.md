# Firestore "Missing or Insufficient Permission" – Student Registration Fix

## What the error meant

Firestore security rules run on every read/write. If the rule evaluates to `false`, the client gets **"Missing or insufficient permissions"**.

For **student self-registration**, the app used to:

1. **Query** the `students` collection by `rollNo` (to check the roll exists and get the document ID).
2. **Create** the Firebase Auth user.
3. **Write** to `users/{uid}` and **update** the student document with `uid` and `email`.

Step 1 ran **before** the user was signed in, so `request.auth` was **null**. The rule `allow read: if request.auth != null` **denied** the read, which produced the permission error.

## Fix applied (no Cloud Functions)

Student registration now works on the **free Firebase plan**:

1. **Create Auth user first**  
   The app calls `createUserWithEmailAndPassword` so the user is **authenticated** before any Firestore access.

2. **Then read and update Firestore**  
   The app queries `students` by rollNo (read allowed for any authenticated user), then writes `users/{uid}` and updates the student doc with `uid` and `email`. The update is allowed by a special rule: any authenticated user may update a student document that has **no `uid` yet**, and only set `uid` to their own auth uid (so they "claim" that record).

3. **Firestore rules (least-privilege)**  
   - **students**: `read` if authenticated; `create`/`delete` only admin or teacher; `update` allowed for admin/teacher **or** for the "claim" case above (doc has no uid, update sets uid to request.auth.uid).

## Deploy

Only Firestore rules need to be deployed (no Cloud Functions):

```bash
firebase deploy --only firestore:rules
```

After that, student self-registration works without the permission error and without any paid Firebase plan.
