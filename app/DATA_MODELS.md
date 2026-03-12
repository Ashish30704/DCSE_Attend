# Firebase Data Models

## Collections Structure

### 1. `users` Collection
Stores authentication and basic user information.

```javascript
{
  uid: string,           // Firebase Auth UID
  name: string,
  rollNo: string,        // Roll number (only for students)
  email: string,
  phone: string,
  role: 'teacher' | 'admin' | 'student',
  department: string,     // Default: 'DCSE'
  createdAt: timestamp
}
```
Auth: login/register by email; students also use roll number. Forgot password uses email (sendPasswordResetEmail).

### 2. `teachers` Collection
Stores teacher information (linked to users).

```javascript
{
  uid: string,           // Firebase Auth UID (links to users collection)
  name: string,
  email: string,
  phone: string,
  department: string,
  createdAt: timestamp
}
```
Teachers are added by admin (name, email, phone); they register with the same email.

### 3. `classes` Collection
Stores class information.

```javascript
{
  name: string,          // e.g., "B.Tech CSE"
  inchargeTeacherId: string,     // Teachers collection document ID
  inchargeTeacherUid: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```
Students are stored in the `students` collection with classId; no embedded students array. Section removed; class is identified by name only.

### 4. `subjects` Collection
Stores subject information linked to classes.

```javascript
{
  name: string,          // e.g., "Data Structures"
  code: string,          // e.g., "CS301"
  classId: string,      // Reference to classes collection document ID
  subjectTeacherId: string,    // Reference to teachers collection (subject incharge)
  subjectTeacherUid: string,   // UID fallback for quick lookups
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### Subcollection: `subjects/{subjectId}/assignments`
Assignments for a subject. Only the subject teacher can create/update/delete.

```javascript
{
  assignmentName: string,   // required
  totalMarks: number,       // required
  description: string|null, // optional
  dueDate: string|null,     // optional, e.g. "YYYY-MM-DD"
  marksVisible: boolean,    // default false; when true, students see marks
  createdAt: timestamp
}
```

#### Subcollection: `subjects/{subjectId}/assignments/{assignmentId}/submissions`
One document per student. Document ID = student's Firebase Auth UID (so students can read own submission). Only subject teacher can write.

```javascript
{
  marksObtained: number,
  evaluatedAt: timestamp,
  evaluatedBy: string       // teacher uid
}
```

### 6. `attendance` Collection
Stores attendance records with scalable structure.

```javascript
{
  attendanceId: string,  // Auto-generated document ID
  classId: string,      // Reference to classes collection
  subjectId: string,    // Reference to subjects collection
  teacherId: string,   // Reference to teachers collection
  date: string,         // Format: "YYYY-MM-DD"
  presentStudents: string[],  // Array of roll numbers (present)
  absentStudents: string[],   // Array of roll numbers (absent)
  sessionId: string,    // Reference to sessions collection
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### 7. `students` Collection
Stores student information. Identified by email + roll number; Firestore document ID used for updates.

```javascript
{
  uid: string,          // Firebase Auth UID (after registration)
  name: string,
  email: string,
  phone: string,
  rollNo: string,      // Roll number (used for attendance)
  classId: string,     // Reference to classes collection
  sessionId: string,   // Current session ID
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### 8. `sessions` Collection
Stores academic session information.

```javascript
{
  name: string,         // e.g., "2024-2025"
  startDate: string,    // Format: "YYYY-MM-DD"
  isActive: boolean,    // Only one session should be active
  createdAt: timestamp,
  archivedAt: timestamp, // When session was archived
  createdBy: string,    // Admin UID who created it
  archivedBy: string,   // Admin UID who archived it
}
```

### 9. `admins` Collection
Stores admin information.

```javascript
{
  uid: string,          // Firebase Auth UID
  name: string,
  email: string,
  phone: string,
  department: string,
  createdAt: timestamp
}
```

## Relationships

- **users** → **teachers**: One-to-one via `uid` field
- **users** → **admins**: One-to-one via `uid` field
- **users** → **students**: One-to-one via `uid` field
- **classes** → **teachers**: Many-to-one via `teacherId`
- **subjects** → **classes**: Many-to-one via `classId`
- **attendance** → **classes**: Many-to-one via `classId`
- **attendance** → **subjects**: Many-to-one via `subjectId`
- **attendance** → **teachers**: Many-to-one via `teacherId`
- **attendance** → **sessions**: Many-to-one via `sessionId`
- **students** → **classes**: Many-to-one via `classId`
- **students** → **sessions**: Many-to-one via `sessionId`
- **classes** → **students**: One-to-many (can be embedded or referenced)
- **subjects** → **assignments**: One-to-many (subcollection)
- **assignments** → **submissions**: One-to-many (subcollection; doc id = student uid)

## Assignment management (security & deploy)

- **Firestore rules:** Deploy with `firebase deploy --only firestore`. Rules in `firestore.rules` restrict assignment/submission writes to the subject teacher; students can read assignments and only their own submission (submission doc id = student's Firebase Auth UID).
- **Cloud Function (optional):** `functions/` contains `onAssignmentCreated` which sends "New Assignment Posted" (Expo Push) to students in the subject's class. Deploy with `cd functions && npm install && cd .. && firebase deploy --only functions`. The app also sends the same notification from the client when the teacher creates an assignment.

## Excel Import/Export Formats

### Teachers Template
| Name | Email | Phone | Department |
|------|-------|-------|------------|
| ...  | ...   | ...   | DCSE       |

### Students Template
| Name | Email | Phone | Roll Number |
|------|-------|-------|-------------|
| ...  | ...   | ...   | 1           |

