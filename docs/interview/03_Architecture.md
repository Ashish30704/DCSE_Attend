# Architecture

The app architecture is a role-based Expo Router application backed by Firebase. The main idea is simple: Firebase Auth tells the app who the user is, Firestore stores the academic data, Redux keeps only the current authenticated profile, and each screen loads the data it owns.

For project layout, see `02_Project_Structure.md`. For auth details, see `10_Authentication.md`. For database design, see `09_Database.md`.

## High-Level Architecture

The runtime layers are:

1. Expo app shell in `app/_layout.tsx`.
2. Global providers: safe area, Redux, `AuthGate`, and `ErrorModalProvider`.
3. Expo Router stack routes declared in `app/_layout.tsx`.
4. Role-specific screen folders: `app/admin/`, `app/teacher/`, and `app/student/`.
5. Service layer under `app/firebase/`.
6. Firebase backend: Auth, Firestore, Hosting, and optional Cloud Functions.

This structure keeps global concerns small and lets each role screen handle the exact data it needs.

## App Shell

`app/_layout.tsx` is the root architecture file. It wraps the app like this:

```text
SafeAreaProvider
  SafeAreaView
    Redux Provider
      AuthGate
        ErrorModalProvider
          StatusBar
          Stack
```

This order matters.

`Provider` must wrap `AuthGate` because `AuthGate` dispatches `setUser()`, `clearUser()`, and `setLoading()` from `app/redux/slices/authSlice.js`.

`AuthGate` wraps the router stack because it decides whether a route can render based on authentication and role.

`ErrorModalProvider` wraps screens so any screen can call `useErrorModal()` for alerts and confirmations.

## Routing Architecture

The app uses Expo Router. Each route is backed by a file under `app/`, and all important route names are listed in `app/_layout.tsx`.

Public routes:

- `app/index.tsx`
- `app/register.tsx`
- `app/forgot-password.tsx`
- `app/verify-email.tsx`

Admin routes:

- `app/admin/dashboard.tsx`
- `app/admin/teachers.tsx`
- `app/admin/classes.tsx`
- `app/admin/subjects.tsx`
- `app/admin/students.tsx`
- `app/admin/class-students.tsx`

Teacher routes:

- `app/teacher/dashboard.tsx`
- `app/teacher/subject.tsx`
- `app/teacher/assignment-marks.tsx`
- `app/teacher/attendance.tsx`
- `app/teacher/attendance-summary.tsx`
- `app/teacher/attendance-matrix.tsx`
- `app/teacher/attendance-export.tsx`

Student routes:

- `app/student/dashboard.tsx`
- `app/student/assignments.tsx`
- `app/student/attendance.tsx`
- `app/student/notifications.tsx`

See `06_Navigation.md` for route parameters and redirect rules.

## Authentication Gate

`app/components/AuthGate.tsx` is the central guard.

It subscribes to Firebase Auth by calling `onAuthStateChanged()` from `app/firebase/authService.js`. When Firebase gives an authenticated user, `AuthGate` loads `users/{uid}` using `getDocument()` from `app/firebase/firestoreService.js`.

If a Firestore user document exists and has a role, it dispatches `setUser()` into Redux with:

- Firebase Auth UID
- Firestore profile fields
- Firebase email verification status

If Firebase has no user or the Firestore user document is invalid, it dispatches `clearUser()`.

The route protection map is local to `AuthGate`:

- `admin` can access `admin/*`
- `teacher` can access `teacher/*`
- `student` can access `student/*`

There is one explicit exception: admins can access `teacher/attendance-summary`. This matches the admin dashboard action card in `app/admin/dashboard.tsx`, which routes to `/teacher/attendance-summary`.

Why this design was chosen:

- It avoids placing auth listeners in every screen.
- It prevents protected screens from rendering before auth state is known.
- It keeps Firebase Auth as the source of truth and Redux as a derived cache.

## State Architecture

Global state is deliberately small. `app/redux/store.jsx` registers only one slice:

- `auth`

The `auth` slice in `app/redux/slices/authSlice.js` stores:

- `user`
- `role`
- `loading`
- `isAuthenticated`

Everything else is local screen state or hook state:

- `teachers` in `app/admin/teachers.tsx`
- `classes` in `app/admin/classes.tsx`
- `subjects` in `app/admin/subjects.tsx`
- `attendance` in `app/teacher/attendance.tsx`
- `assignments` in `app/hooks/useAssignments.ts`
- `submissions` in `app/hooks/useAssignmentSubmissions.ts`

This keeps stale global data from building up and matches the fact that most screens own very specific query results.

See `07_State_Management.md` for details.

## Firebase Service Layer

The app puts backend operations under `app/firebase/`.

### `app/firebase/config.js`

Initializes Firebase and exports:

- `auth`
- `firestore`
- default Firebase app

It uses platform-specific persistence:

- web auth uses `browserLocalPersistence`
- native auth uses `getReactNativePersistence(AsyncStorage)`
- web Firestore uses `persistentLocalCache` with `persistentMultipleTabManager`
- native Firestore uses `persistentLocalCache`

The reason is reload safety on web and persistent auth on native devices.

### `app/firebase/authService.js`

Owns authentication operations:

- login
- register student, teacher, and admin users
- logout
- current user access
- auth state subscription
- password reset
- email verification resend
- auth user reload

Registration is role-specific because teachers and students must match pre-existing roster records.

### `app/firebase/firestoreService.js`

Provides generic helpers:

- `getDocument`
- `getCollection`
- `setDocument`
- `addDocument`
- `updateDocument`
- `deleteDocument`
- `queryCollection`
- `queryCollectionWithLimit`
- `serverTimestamp`

The helper has Firestore availability fallbacks. If Firestore is unavailable, some functions return mock values or empty arrays so UI can still avoid crashing.

### `app/firebase/sessionService.js`

Handles academic sessions:

- `getCurrentSession`
- `getAllSessions`
- `resetSession`
- `getSessionById`

The client-side `resetSession()` only archives the current session and creates a new session. It does not wipe attendance, classes, teachers, students, or users. The admin dashboard modal in `app/admin/dashboard.tsx` states this clearly.

### `app/firebase/assignmentService.js`

Encapsulates nested assignment data:

- assignments live under `subjects/{subjectId}/assignments`
- submissions live under `subjects/{subjectId}/assignments/{assignmentId}/submissions`

This service avoids scattering subcollection path construction across screens.

### `app/firebase/notificationService.js`

Sends push notifications without storing notification documents. It looks up students and their push tokens, then calls `sendPushNotification()` from `app/utils/pushNotifications.js`.

## Screen Architecture

The app uses screen-level ownership. Each screen:

- loads the data it needs
- owns its loading state
- owns its form state
- calls service functions
- shows errors through `useErrorModal()`

For example:

- `app/admin/teachers.tsx` owns the teachers list, teacher form, import modal, and CRUD calls.
- `app/teacher/attendance.tsx` owns selected date, attendance map, authorization check, and save logic.
- `app/student/assignments.tsx` owns the grouped subject/assignment data and marks map.

This is straightforward and interview-friendly because each file maps closely to one use case.

## Data Architecture

The most important Firestore relationships are:

- `users` links Firebase Auth UIDs to app roles.
- `teachers` stores teacher roster records and later receives `uid`.
- `students` stores student roster records and later receives `uid`.
- `classes` references teacher document IDs and/or UIDs.
- `subjects` references classes and teachers.
- `attendance` references class, subject, teacher, date, and session.
- assignment subcollections live under subjects.
- submission subcollections live under assignments.
- `sessions` tracks active academic sessions.
- `userPushTokens` stores Expo push tokens by user UID.

See `09_Database.md` for field details and examples.

## Authorization Architecture

Authorization is enforced at multiple levels:

1. Route-level protection in `app/components/AuthGate.tsx`.
2. Screen-level role checks in dashboards like `app/admin/dashboard.tsx`, `app/teacher/dashboard.tsx`, and `app/student/dashboard.tsx`.
3. Assignment ownership checks in `firestore.rules` through `isSubjectTeacher(subjectId)`.
4. Runtime teacher assignment checks in teacher screens such as `app/teacher/attendance.tsx` and `app/teacher/attendance-matrix.tsx`.

The architecture intentionally protects routes before screens render, but it also performs screen-level checks where the data itself requires more precise ownership validation.

Example: `app/teacher/attendance.tsx` does not just trust that the user is a teacher. It loads teacher docs, class docs, and subject docs to verify the teacher is assigned as class incharge or subject teacher.

## Cloud Function Architecture

Cloud Functions live under `functions/`.

`functions/index.js` exports:

- `startNewAcademicSession`
- `registerStudent`
- `onAssignmentCreated`

`startNewAcademicSession` wraps `runAcademicSessionReset()` from `functions/academicSessionReset.js`.

The full reset function uses Admin SDK because deleting many collections, deleting Auth users, writing audit logs, and bypassing client Firestore rules cannot be safely done from the mobile/web app.

Important distinction:

- `app/firebase/sessionService.js` has a simple client reset that archives and creates sessions.
- `functions/academicSessionReset.js` has a full destructive reset that wipes non-admin academic data and Auth users.

The admin dashboard currently uses the simple client reset, not the full callable Cloud Function.

## Notification Architecture

Notifications use Expo Push, not Firebase Cloud Messaging directly in the client.

Device registration:

- `app/student/dashboard.tsx` calls `registerForPushNotificationsAsync(user.uid)`.
- `app/utils/pushNotifications.js` requests notification permissions and stores the Expo token in `userPushTokens/{uid}`.

Attendance notification:

- `app/teacher/attendance.tsx` saves attendance.
- It calls `createAttendanceNotifications()` from `app/firebase/notificationService.js`.
- That service reads students in the class and sends each registered student a push notification.

Assignment notification:

- `app/teacher/subject.tsx` calls `createAssignmentNotifications()` after assignment creation.
- `functions/index.js` also has `onAssignmentCreated` to notify enrolled students when an assignment document is created.

Interview note: the presence of both client-side and Cloud Function assignment notification paths is an important implementation detail.

## Excel Architecture

Excel import/export is centralized in `app/utils/excelService.js`.

Import path:

- `importExcel()` uses `expo-document-picker`.
- It reads the selected file with `expo-file-system` as Base64.
- It parses the first sheet with `xlsx`.
- It returns JSON rows.

Export path:

- `exportToExcel()` converts JSON to a worksheet.
- On web, it calls `XLSX.writeFile()` to download.
- On native, it writes a Base64 `.xlsx` file to cache and opens the native share sheet through `expo-sharing`.

This is used by:

- `app/admin/teachers.tsx`
- `app/admin/class-students.tsx`
- `app/admin/classes.tsx`
- `app/teacher/attendance-export.tsx`

## UI Architecture

The UI system is mostly NativeWind classes plus shared components.

Common wrappers:

- `GradientBackground` in `app/components/ui/kit.tsx`
- `ScrollContainer` in `app/components/ui/kit.tsx`
- `GlassCard` in `app/components/ui/kit.tsx`

Common controls:

- `PrimaryButton`
- `SecondaryButton`
- `Button`
- `Input`
- `Header`
- `Modal`
- `Loader`
- `EmptyState`
- `ScreenSkeleton`

The reason for this pattern is consistency without a heavy design system. Screens remain readable, but repeated layout and interaction patterns are reusable.

## Build and Web Hosting Architecture

Expo web output is configured as static in `app.json`:

`"web": { "output": "static" }`

Firebase Hosting serves the `dist` folder and rewrites all routes to `/index.html` in `firebase.json`.

This matters because Expo Router routes like `/teacher/dashboard` need to work when directly loaded in a browser.

`metro.config.js` includes font asset extensions because Ionicons must be available in production web builds.

## Why the Architecture Works for This Project

The project has clear role boundaries. The architecture follows those boundaries instead of abstracting everything into one generic dashboard.

That gives three benefits:

- Admin files are easy to explain as setup and roster management.
- Teacher files are easy to explain as operational workflows.
- Student files are easy to explain as read-only personal views.

The service layer keeps Firebase details reusable, while local screen state keeps each workflow understandable.

## Known Architectural Trade-Offs

Some rules are enforced in the client but not fully mirrored in Firestore rules:

- Attendance edit deadline before 5 PM is enforced in `app/teacher/attendance.tsx`, while `firestore.rules` allows any authenticated read/write on `attendance`.
- Class incharge uniqueness is enforced in `app/admin/classes.tsx`, while `firestore.rules` allows authenticated writes to `classes`.

Some older or unused files remain:

- `app/screens/TeachDashboardScreen.jsx`
- `app/screens/RegistrationScreen.jsx`
- `app/screens/SplashScreen.jsx`
- `app/utils/firebase.js`

Some functionality exists in Cloud Functions but is not used by the current client flow:

- `functions/index.js` exports `registerStudent`, but `app/firebase/authService.js` handles student registration client-side.
- `functions/academicSessionReset.js` implements full reset, but `app/admin/dashboard.tsx` uses the simpler client session reset.
