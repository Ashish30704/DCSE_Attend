# Project Structure

This project uses Expo Router, so the `app/` directory is both the application source folder and the routing map. A file like `app/teacher/attendance.tsx` becomes a route like `/teacher/attendance`.

For the high-level purpose of the app, read `01_Project_Overview.md`. For route behavior, read `06_Navigation.md`.

## Root Files

### `package.json`

`package.json` defines the app as an Expo Router app with:

- `main: "expo-router/entry"`
- scripts for `expo start`, native builds, web, and linting
- dependencies for Expo, React Native, Firebase, Redux Toolkit, NativeWind, Expo Notifications, Excel import/export, and React Native Calendars

Important dependencies connected to the code:

- `expo-router` powers file-based routing in `app/_layout.tsx`.
- `firebase` powers auth, Firestore, and callable/client Firebase APIs.
- `@reduxjs/toolkit` and `react-redux` power auth state in `app/redux/`.
- `nativewind` and `tailwindcss` support className-based styling in React Native.
- `expo-notifications`, `expo-device`, and `expo-constants` support push tokens in `app/utils/pushNotifications.js`.
- `xlsx`, `expo-document-picker`, `expo-file-system`, and `expo-sharing` support Excel import/export in `app/utils/excelService.js`.
- `@shopify/flash-list` is used by `app/teacher/assignment-marks.tsx` for a virtualized marks list.

### `app.json`

`app.json` configures the Expo app:

- app name and slug: `DCSE`
- platforms: iOS, Android, web
- static web output
- Android package: `com.anonymous.DCSE`
- Expo Router plugin
- Expo Notifications plugin
- Expo Splash Screen plugin
- EAS project ID used by push notifications

The app references assets such as `./assets/images/logo.png` and `./assets/images/splash.png`. Those paths are used by Expo config, although the workspace file search did not surface the asset files during this review.

### `firebase.json`

`firebase.json` configures Firebase Hosting, Firestore, and Functions:

- Hosting serves `dist`.
- Hosting rewrites all routes to `/index.html`, which is required for Expo Router static web routing.
- Firestore rules are in `firestore.rules`.
- Firestore indexes are in `firestore.indexes.json`.
- Functions source is `functions/`.

### `.firebaserc`

`.firebaserc` points the default Firebase project to `dcse-cdlu`.

### `firestore.rules`

`firestore.rules` defines security access for all Firestore collections. It is important for authentication, registration, assignment permissions, push tokens, and backend-only audit collections. See `08_Firebase.md`, `09_Database.md`, and `10_Authentication.md`.

### `firestore.indexes.json`

`firestore.indexes.json` defines a composite index for `attendance` on:

- `classId`
- `subjectId`
- `date`
- document name

This matches attendance export and attendance lookup patterns in files like `app/teacher/attendance-export.tsx`.

### `tailwind.config.js`

`tailwind.config.js` configures NativeWind content scanning for `app/**/*.{js,jsx,ts,tsx}` and defines:

- primary colors
- surface colors
- responsive breakpoints
- max widths like `max-w-content` and `max-w-wide`

These classes are used heavily in screens and components.

### `babel.config.js`

`babel.config.js` enables Expo and NativeWind transforms:

- `babel-preset-expo`
- `nativewind/babel`

### `metro.config.js`

`metro.config.js` wraps Expo's Metro config with NativeWind and adds support for `cjs` and font asset extensions. The comment explains the web production reason: icon fonts must stay bundled for Firebase Hosting so Ionicons do not render as placeholder glyphs.

### `global.css`

`global.css` imports Tailwind layers and adds web-only overflow guards so the app does not exceed viewport width on small screens or web hosting.

### `tsconfig.json`

`tsconfig.json` extends Expo's TypeScript base config, enables `strict`, and defines an alias path:

`@/* -> ./*`

The current code mostly uses relative imports instead of the alias.

### `eas.json`

`eas.json` defines EAS build profiles:

- `development`
- `preview`
- `production`
- `apk`

The `production` profile auto-increments the version and uses store distribution.

## `app/` Directory

The `app/` directory contains the Expo Router app. It includes routes, screens, Firebase services, Redux, hooks, utilities, and shared components.

## Core App Shell

### `app/_layout.tsx`

`app/_layout.tsx` is the root layout. It:

- prevents the splash screen from hiding too early
- loads Ionicons fonts
- wraps the app in `SafeAreaProvider`
- wraps state in Redux `Provider`
- wraps all routes in `AuthGate`
- wraps UI in `ErrorModalProvider`
- declares the route stack

This is the central file for app startup and route registration.

### `app/index.tsx`

`app/index.tsx` renders `LoginScreen` for unauthenticated users. It also sets up Expo notification listeners after a user exists in Redux. It does not own authentication resolution; `AuthGate` does that.

### `app/register.tsx`

`app/register.tsx` simply exports `RegisterScreen` from `app/screens/RegisterScreen.jsx`.

### `app/forgot-password.tsx`

`app/forgot-password.tsx` provides the password reset screen and calls `sendPasswordReset()` from `app/firebase/authService.js`.

### `app/verify-email.tsx`

`app/verify-email.tsx` allows a signed-in user to resend email verification, reload the Firebase Auth user, and route to the correct dashboard after verification.

## Route Folders

### `app/admin/`

Admin route files:

- `app/admin/dashboard.tsx`
- `app/admin/teachers.tsx`
- `app/admin/classes.tsx`
- `app/admin/subjects.tsx`
- `app/admin/students.tsx`
- `app/admin/class-students.tsx`

These files are responsible for setup and roster management. They call Firestore helpers from `app/firebase/firestoreService.js`, session helpers from `app/firebase/sessionService.js`, and Excel helpers from `app/utils/excelService.js`.

### `app/teacher/`

Teacher route files:

- `app/teacher/dashboard.tsx`
- `app/teacher/subject.tsx`
- `app/teacher/attendance.tsx`
- `app/teacher/attendance-summary.tsx`
- `app/teacher/attendance-matrix.tsx`
- `app/teacher/attendance-export.tsx`
- `app/teacher/assignment-marks.tsx`

These screens handle assigned classes, subjects, attendance, assignments, marks, exports, and summary views.

### `app/student/`

Student route files:

- `app/student/dashboard.tsx`
- `app/student/attendance.tsx`
- `app/student/assignments.tsx`
- `app/student/notifications.tsx`

These screens are read-heavy. Students view data created by admins and teachers.

## `app/screens/`

This folder contains screen components used by routes or older code:

- `app/screens/LoginScreen.jsx` is active through `app/index.tsx`.
- `app/screens/RegisterScreen.jsx` is active through `app/register.tsx`.
- `app/screens/RegistrationScreen.jsx` is a placeholder and is not used by the current route stack.
- `app/screens/SplashScreen.jsx` is mostly commented old navigation code plus a placeholder and is not used by the current route stack.
- `app/screens/TeachDashboardScreen.jsx` is a hardcoded sample dashboard and is not registered in `app/_layout.tsx`.

Interview note: it is important not to describe the placeholder/sample screens as production flows. The active screens are the route files listed in `app/_layout.tsx`.

## `app/components/`

Shared components:

- `app/components/AuthGate.tsx` handles Firebase auth state and role-based route protection.
- `app/components/ErrorModal.tsx` provides global modal alerts, success messages, info messages, and confirms.
- `app/components/DepartmentLogo.tsx` renders the department logo from `assets/images/mainLogo.jpeg`.
- `app/components/layout/ScreenLayout.tsx` provides a max-width wrapper, although many screens use `GradientBackground` and `ScrollContainer` directly.

## `app/components/ui/`

Reusable UI primitives:

- `Button.tsx`
- `Card.tsx`
- `Input.tsx`
- `Header.tsx`
- `EmptyState.tsx`
- `Loader.tsx`
- `ScreenSkeleton.tsx`
- `Modal.tsx`
- `kit.tsx`
- `index.ts`

`kit.tsx` contains the most-used UI primitives:

- `GradientBackground`
- `GlassCard`
- `PrimaryButton`
- `SecondaryButton`
- `SectionHeading`
- `StatCard`
- `PillTag`
- `ScrollContainer`

See `04_Component_Guide.md` for more detail.

## `app/firebase/`

Firebase service files:

- `app/firebase/config.js` initializes Firebase Auth and Firestore with platform-specific persistence.
- `app/firebase/authService.js` handles login, registration, logout, password reset, email verification, and auth state subscription.
- `app/firebase/firestoreService.js` provides generic Firestore CRUD/query helpers.
- `app/firebase/sessionService.js` handles active academic sessions and simple client-side session reset.
- `app/firebase/assignmentService.js` handles assignment and submission subcollections.
- `app/firebase/notificationService.js` sends Expo push notifications for attendance and assignments.

## `app/redux/`

Redux files:

- `app/redux/store.jsx`
- `app/redux/slices/authSlice.js`

The store currently has only one reducer: `auth`. More details are in `07_State_Management.md`.

## `app/hooks/`

Custom hooks:

- `app/hooks/useAssignments.ts`
- `app/hooks/useAssignmentSubmissions.ts`

These wrap assignment/submission service calls with local loading and error state.

## `app/utils/`

Utility files:

- `app/utils/excelService.js` imports and exports Excel files.
- `app/utils/pushNotifications.js` registers devices, stores Expo tokens, reads tokens, and sends push notifications.
- `app/utils/phoneUtils.ts` normalizes and validates Indian phone numbers.
- `app/utils/colors.js` contains a simple color object.
- `app/utils/firebase.js` is commented old Firebase setup and not active.

## `app/theme/`

Theme constants:

- `app/theme/colors.ts`
- `app/theme/spacing.ts`

These provide typed design constants, although many screens use Tailwind/NativeWind classes directly.

## `functions/`

Firebase Cloud Functions files:

- `functions/package.json`
- `functions/index.js`
- `functions/academicSessionReset.js`

`functions/index.js` exports:

- `startNewAcademicSession`, a callable function wrapping the full reset logic.
- `registerStudent`, a callable student registration function.
- `onAssignmentCreated`, a Firestore trigger that sends Expo push notifications when assignments are created.

`functions/academicSessionReset.js` contains the full academic reset implementation using Admin SDK batched deletes, a lock document, session rotation, audit logs, and non-admin Auth user deletion.

Important implementation detail: the current client `registerUser()` in `app/firebase/authService.js` does not call the Cloud Function `registerStudent`; it implements student registration directly in the client after creating the Auth user. That matches `STUDENT_REGISTRATION_SETUP.md`.

## Existing Documentation Files

Existing docs before this folder:

- `README.md`: default Expo starter text.
- `app/README.md`: project-specific feature summary.
- `AUTH_ARCHITECTURE.md`: authentication architecture.
- `PERMISSION_FIX.md`: student registration permission fix.
- `STUDENT_REGISTRATION_SETUP.md`: no-Cloud-Functions student registration setup.
- `app/DATA_MODELS.md`: Firestore data model overview.
- `app/FIREBASE_EMAIL_SETUP.md`: Firebase Auth email setup.

## Generated Interview Documentation

The generated files in `docs/interview/` are:

- `01_Project_Overview.md`
- `02_Project_Structure.md`
- `03_Architecture.md`
- `04_Component_Guide.md`
- `05_Screens.md`
- `06_Navigation.md`
- `07_State_Management.md`
- `08_Firebase.md`
- `09_Database.md`
- `10_Authentication.md`

These files should be updated whenever the real implementation changes.
