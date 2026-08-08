# Project Overview

This project is a DCSE attendance management app built with Expo, React Native, Expo Router, Firebase Authentication, Firestore, Redux Toolkit, NativeWind, Expo Notifications, and Excel import/export utilities.

The app is not a generic attendance starter. The current code is shaped around three real roles in the Department of Computer Science and Engineering:

- Admins manage the academic setup: teachers, classes, subjects, students, and sessions.
- Teachers view their assigned classes and subjects, mark attendance, manage assignments, enter marks, and export attendance.
- Students view their own dashboard, attendance, assignments, marks, and push-notification status.

For a deeper breakdown, read:

- `02_Project_Structure.md` for folders and file responsibilities.
- `03_Architecture.md` for how the app is layered.
- `05_Screens.md` for each route and user-facing screen.
- `08_Firebase.md`, `09_Database.md`, and `10_Authentication.md` for backend, data, and auth details.

## What the App Does

The core problem solved by this project is attendance and academic record management for DCSE. The app lets an administrator create the roster first, then lets teachers and students operate on that roster.

The actual implemented flow is:

1. Admin creates teachers in `app/admin/teachers.tsx`.
2. Admin creates classes and assigns class incharges in `app/admin/classes.tsx`.
3. Admin creates subjects and assigns subject teachers in `app/admin/subjects.tsx`.
4. Admin adds/imports students into a class in `app/admin/class-students.tsx` or manages them in `app/admin/students.tsx`.
5. Teachers and students register through `app/screens/RegisterScreen.jsx`.
6. Teachers open `app/teacher/dashboard.tsx`, choose a subject in `app/teacher/subject.tsx`, and mark attendance in `app/teacher/attendance.tsx`.
7. Students open `app/student/dashboard.tsx`, then view attendance in `app/student/attendance.tsx` or assignments in `app/student/assignments.tsx`.

The design is roster-first because teacher and student registration is validated against existing Firestore records. This avoids unknown users creating accounts without being listed by an admin.

## Main Technology Choices

The app uses Expo Router because routes are represented directly by files under `app/`. The route list is declared in `app/_layout.tsx`, and screen files like `app/admin/dashboard.tsx`, `app/teacher/attendance.tsx`, and `app/student/dashboard.tsx` become routes.

Firebase is used because the app needs authentication, a cloud database, security rules, hosting, and optional Cloud Functions. Firebase setup appears in:

- `app/firebase/config.js`
- `app/firebase/authService.js`
- `app/firebase/firestoreService.js`
- `firestore.rules`
- `firebase.json`
- `functions/index.js`

Redux Toolkit is used only for authentication session state. The store is intentionally small in `app/redux/store.jsx`, with one slice in `app/redux/slices/authSlice.js`. Feature data such as teachers, classes, subjects, attendance, assignments, and students is fetched locally inside screens and hooks instead of being stored globally.

NativeWind and Tailwind-style class names are used for layout and styling. The configuration is in `tailwind.config.js`, `babel.config.js`, `metro.config.js`, and `global.css`.

## Main Roles

### Admin

Admin features are implemented under `app/admin/`:

- `app/admin/dashboard.tsx` shows counts for teachers, classes, and students, shows the current session, and links to management screens.
- `app/admin/teachers.tsx` supports add, edit, delete, Excel import, Excel export, and template export for teachers.
- `app/admin/classes.tsx` supports class creation and class incharge assignment.
- `app/admin/subjects.tsx` links subjects to classes and subject teachers.
- `app/admin/class-students.tsx` manages students inside one class and supports Excel import/export.
- `app/admin/students.tsx` provides search, class filtering, editing, and deletion across the current session.

The admin dashboard also links to `/teacher/attendance-summary`. `app/components/AuthGate.tsx` has an explicit exception allowing an admin to access `teacher/attendance-summary`.

### Teacher

Teacher features are implemented under `app/teacher/`:

- `app/teacher/dashboard.tsx` loads classes where the teacher is class incharge and subjects where the teacher is subject teacher.
- `app/teacher/subject.tsx` manages assignments for a selected subject and links to attendance.
- `app/teacher/attendance.tsx` marks attendance for a class and subject on a selected date.
- `app/teacher/assignment-marks.tsx` records marks for assignment submissions.
- `app/teacher/attendance-export.tsx` exports monthly attendance to Excel.
- `app/teacher/attendance-matrix.tsx` gives class incharges a matrix view across subjects and dates.
- `app/teacher/attendance-summary.tsx` summarizes attendance percentages and highlights students below 75 percent.

The code uses both teacher document IDs and Firebase Auth UIDs. That is visible in `app/teacher/dashboard.tsx`, which queries `teachers` by `uid`, then checks fields such as `inchargeTeacherId`, `inchargeTeacherUid`, `subjectTeacherId`, `subjectTeacherUid`, and legacy `teacherId`.

### Student

Student features are implemented under `app/student/`:

- `app/student/dashboard.tsx` shows the student's class, subject count, and links to assignments, notifications, and attendance.
- `app/student/attendance.tsx` shows attendance records by subject.
- `app/student/assignments.tsx` shows assignments grouped by subject and displays marks when available.
- `app/student/notifications.tsx` explains that push notifications are enabled; it does not display a stored notification inbox.

The student dashboard registers Expo push notifications through `app/utils/pushNotifications.js`. The token is saved in Firestore under `userPushTokens/{uid}`.

## What Data the App Manages

The active Firestore collections used by the client and functions are:

- `users`
- `admins`
- `teachers`
- `classes`
- `subjects`
- `subjects/{subjectId}/assignments`
- `subjects/{subjectId}/assignments/{assignmentId}/submissions`
- `students`
- `attendance`
- `sessions`
- `userPushTokens`
- `system`, `auditLogs`, and `sessionArchives` for backend-only reset support

See `09_Database.md` for field-by-field details.

## Key Workflows

### Registration Workflow

The app supports email/password registration in `app/screens/RegisterScreen.jsx`, backed by `registerUser()` in `app/firebase/authService.js`.

Student registration creates the Firebase Auth user first, then queries `students` by `rollNo`, writes `users/{uid}`, and updates the matching student document with `uid` and `email`.

Teacher registration also creates the Firebase Auth user first, then looks for a matching teacher document by email. If the email is not already in the `teachers` collection, registration fails.

Admin registration creates an auth user, writes `users/{uid}` with role `admin`, and adds an `admins` collection document.

This design exists because Firestore rules require authentication before reading the roster collections. Existing docs `PERMISSION_FIX.md` and `STUDENT_REGISTRATION_SETUP.md` explain the student registration permission fix.

### Attendance Workflow

A teacher opens `app/teacher/attendance.tsx` through `app/teacher/subject.tsx`. The screen verifies the teacher is assigned either as class incharge or subject teacher before loading students.

Attendance is saved in the `attendance` collection with:

- `classId`
- `subjectId`
- `teacherId`
- `date`
- `presentStudents`
- `absentStudents`
- `sessionId`
- `createdAt`

The screen enforces a same-day, before-5-PM edit rule in app code. Firestore rules currently allow authenticated reads/writes for `attendance`, so the time lock is a client-side rule, not a Firestore rule.

### Assignment Workflow

Assignments are subcollection documents under `subjects/{subjectId}/assignments`. The teacher screen `app/teacher/subject.tsx` creates, updates, deletes, and toggles visibility for assignments.

Marks are saved in `app/teacher/assignment-marks.tsx` using `setSubmission()` from `app/firebase/assignmentService.js`. Submission documents live under:

`subjects/{subjectId}/assignments/{assignmentId}/submissions/{studentIdOrUid}`

Students read assignments in `app/student/assignments.tsx`, then match submissions with `pickSubmissionForStudent()`.

### Notification Workflow

The app uses Expo push notifications, not an in-app notification database.

Student devices register in `app/student/dashboard.tsx` through `registerForPushNotificationsAsync()` in `app/utils/pushNotifications.js`. Tokens are stored under `userPushTokens/{uid}`.

Attendance notifications are sent by `createAttendanceNotifications()` in `app/firebase/notificationService.js` after attendance is saved.

Assignment notifications are sent in two places:

- Client side through `createAssignmentNotifications()` in `app/firebase/notificationService.js`.
- Backend side through `onAssignmentCreated` in `functions/index.js`.

Because both exist, interviewers may ask whether the app could send duplicate assignment notifications if both paths are active.

## Why the Project Is Structured This Way

The project favors simple, role-based screens over a large abstraction layer. That makes sense for an academic management app because each role has different responsibilities and different data access needs.

Examples:

- `app/admin/teachers.tsx` focuses on teacher roster management.
- `app/teacher/attendance.tsx` focuses on one class-subject-date attendance task.
- `app/student/attendance.tsx` focuses on read-only student attendance.

The shared logic is extracted where it is repeated:

- Firebase initialization is centralized in `app/firebase/config.js`.
- Auth operations are centralized in `app/firebase/authService.js`.
- Generic Firestore CRUD helpers live in `app/firebase/firestoreService.js`.
- Assignment subcollection operations live in `app/firebase/assignmentService.js`.
- Reusable UI primitives live in `app/components/ui/`.

## Existing Documentation

The repo already includes useful source documentation:

- `AUTH_ARCHITECTURE.md` describes the auth gate design.
- `PERMISSION_FIX.md` explains why student registration creates the Auth user before Firestore reads.
- `STUDENT_REGISTRATION_SETUP.md` documents the no-Cloud-Functions student registration path.
- `app/DATA_MODELS.md` describes Firestore collections.
- `app/FIREBASE_EMAIL_SETUP.md` explains password reset and verification email setup.
- `app/README.md` summarizes app features.

The interview docs in this folder are generated from the actual code and should be treated as a code-based guide. If implementation changes, update these files with the code.

## Important Caveats

Several files are present but not part of the active route flow:

- `app/screens/RegistrationScreen.jsx` is a placeholder.
- `app/screens/SplashScreen.jsx` contains mostly commented historical navigation code and a placeholder view.
- `app/screens/TeachDashboardScreen.jsx` uses hardcoded sample teacher/class data and is not registered in `app/_layout.tsx`.
- `app/utils/firebase.js` contains commented old Firebase setup.

The root `README.md` still has default Expo starter content, while `app/README.md` is the project-specific README.

The code references image assets such as `assets/images/mainLogo.jpeg`, `assets/images/logo.png`, and `assets/images/splash.png`. Those references appear in `DepartmentLogo.tsx`, login/register screens, and `app.json`, but the workspace file search did not show an `assets/` folder during this review.
