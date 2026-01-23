# Firebase Data Models

## Collections Structure

### 1. `users` Collection
Stores authentication and basic user information.

```javascript
{
  uid: string,           // Firebase Auth UID
  name: string,
  id: string,            // Teacher ID or Admin ID (not for students)
  rollNo: string,        // Roll number (only for students)
  email: string,
  phone: string,
  role: 'teacher' | 'admin' | 'student',
  department: string,     // Default: 'DCSE'
  createdAt: timestamp
}
```

### 2. `teachers` Collection
Stores teacher information (linked to users).

```javascript
{
  uid: string,           // Firebase Auth UID (links to users collection)
  name: string,
  id: string,            // Teacher ID
  email: string,
  phone: string,
  department: string,
  createdAt: timestamp
}
```

### 3. `classes` Collection
Stores class information.

```javascript
{
  name: string,          // e.g., "B.Tech CSE"
  section: string,      // e.g., "A", "B", "C"
  inchargeTeacherId: string,     // Reference to teachers collection document ID
  inchargeTeacherUid: string,    // UID fallback for quick lookups
  students: [
    {
      studentId: string,
      name: string,
      email: string,
      phone: string,
      rollNumber: string
    }
  ],
  createdAt: timestamp,
  updatedAt: timestamp
}
```

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
Stores student information.

```javascript
{
  uid: string,          // Firebase Auth UID (after registration)
  studentId: string,    // Unique student identifier
  name: string,
  email: string,
  phone: string,
  rollNo: string,      // Roll number (used for attendance)
  classId: string,     // Reference to classes collection
  sessionId: string,    // Current session ID
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
  id: string,           // Admin ID
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

## Excel Import/Export Formats

### Teachers Template
| Teacher ID | Name | Email | Phone | Department |
|------------|------|-------|-------|------------|
| TCH001     | ...  | ...   | ...   | DCSE       |

### Students Template
| Student ID | Name | Email | Phone | Roll Number | Class ID |
|------------|------|-------|-------|-------------|----------|
| STU001     | ...  | ...   | ...   | 1           | class-id |

