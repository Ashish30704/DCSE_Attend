# Student registration (no Cloud Functions required)

Student registration works on the **free Firebase plan** (no Blaze / Cloud Functions needed).

## How it works

1. The app creates the **Firebase Auth user** first (email/password).
2. The app then **queries** the `students` collection by roll number (allowed because the user is now authenticated).
3. The app **writes** `users/{uid}` and **updates** the matching student doc with `uid` and `email` (allowed by Firestore rules for this “claim” case).

## Firestore rules

The `students` collection allows:

- **Read**: any authenticated user.
- **Create / delete**: only admin or teacher.
- **Update**: admin/teacher, **or** any authenticated user when the document has **no `uid` yet** and the update sets `uid` to their own auth uid (so students can “claim” their record once).

Deploy rules after any change:

```bash
firebase deploy --only firestore:rules
```

## No setup required

You do **not** need to deploy Cloud Functions. Student registration works in Expo Go and in production as long as:

- The student’s roll number exists in the `students` collection (added by admin).
- Firestore rules are deployed as above.
