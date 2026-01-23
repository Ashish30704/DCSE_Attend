# DCSE Attendance Management App

A React Native Expo app for managing attendance in the Department of Computer Science and Engineering (DCSE).

## Features

### Admin Features
- **Dashboard**: View statistics (teachers, classes, students) and manage sessions
- **Session Management**: Reset academic sessions while preserving historical data
- **Manage Teachers**: Add, edit, delete teachers with Excel import/export
- **Manage Classes**: Create and manage classes, assign teachers
- **Manage Subjects**: Assign subjects to classes
- **Manage Students**: Add students with Excel import/export

### Teacher Features
- **Dashboard**: View assigned classes and subjects
- **Attendance Management**: Mark attendance for students by date
- **Monthly Export**: Export attendance in Excel format (rows=students, columns=dates)
- **View Classes**: See all assigned classes with student counts

### Student Features
- **Dashboard**: View attendance statistics
- **Attendance View**: View personal attendance records by subject and date (read-only)

## User Roles

### Admin
- Can manage all teachers, classes, subjects, and students
- Can import/export data via Excel
- Can reset academic sessions
- Full administrative access

### Teacher
- Can view assigned classes and subjects
- Can mark attendance for students
- Can export monthly attendance reports
- Limited to their assigned classes

### Student
- Can view their own attendance records
- Read-only access to attendance data
- Filter by subject and date

## Data Fields

### Teacher
- Name (required)
- Teacher ID (required)
- Email (required)
- Phone (optional)

### Student
- Student ID (required)
- Name (required)
- Email (required)
- Roll Number (optional)
- Phone (optional)

## Excel Import/Export

### Teachers Format
| Teacher ID | Name | Email | Phone | Department |
|------------|------|-------|-------|------------|

### Students Format
| Student ID | Name | Email | Phone | Roll Number |
|------------|------|-------|-------|-------------|

## Firebase Collections

- `users`: User authentication data
- `teachers`: Teacher information
- `classes`: Class information with students
- `subjects`: Subject information linked to classes
- `attendance`: Attendance records by date, class, and subject

## Responsive Design

The app uses Tailwind CSS with responsive breakpoints:
- `sm`: 320px (Small phones)
- `md`: 480px (Large phones)
- `lg`: 768px (Tablets)

## Getting Started

1. Make sure Firebase is configured in `app/firebase/config.js`
2. Run `npm install` to install dependencies
3. Start the app with `npm start` or `expo start`
4. Register an admin account first to manage the system
5. Import students via Excel (students must exist before they can register)
6. Register teacher accounts and assign them to classes
7. Students can register using their roll number (validated against database)
8. Teachers can then mark attendance
9. Students can view their attendance records

## Navigation Flow

1. **Login/Register** → Select role (Admin, Teacher, or Student)
2. **Admin Dashboard** → Manage Teachers/Classes/Subjects/Students/Sessions
3. **Teacher Dashboard** → View Classes → Select Subject → Mark Attendance → Export Monthly Reports
4. **Student Dashboard** → View Attendance by Subject and Date

