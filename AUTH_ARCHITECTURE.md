# Production-Safe Authentication Architecture

## Overview

This document describes the refactored authentication and routing architecture that ensures:
- **Firebase Auth as single source of truth**
- **Reload-safe state persistence** (web/PWA)
- **Role-based route protection**
- **Prevention of unauthorized access**
- **No Firestore queries without authentication**

## Architecture Components

### 1. AuthGate Component (`app/components/AuthGate.tsx`)

**Purpose**: Global authentication gate that wraps the entire app above Expo Router Stack.

**Key Responsibilities**:
- Subscribes to Firebase Auth state changes
- Syncs Redux state from Firebase Auth (Firebase is source of truth)
- Blocks rendering until auth state is resolved
- Handles role-based route protection
- Redirects unauthorized access to login screen

**How it works**:
1. On mount, subscribes to `onAuthStateChanged` from Firebase
2. When auth state changes, fetches user data from Firestore
3. Syncs user data to Redux via `setUser()` or `clearUser()`
4. Blocks rendering with loading spinner until first auth state resolves
5. After initialization, enforces route protection based on user role

### 2. RootLayout (`app/_layout.tsx`)

**Purpose**: Wraps AuthGate around the app and provides route definitions.

**Structure**:
```
SafeAreaProvider
  └── Redux Provider
      └── AuthGate (handles auth + route protection)
          └── ErrorModalProvider
              └── Expo Router Stack
```

### 3. AuthSlice (`app/redux/slices/authSlice.js`)

**Changes**:
- **Removed `setUser(null)` usage**: Now uses `clearUser()` exclusively
- **Added validation**: `setUser()` rejects null values with error log
- **Documentation**: Added comments explaining proper usage

**State Shape**:
```javascript
{
  user: object | null,      // User data from Firestore
  role: 'admin' | 'teacher' | 'student' | null,
  loading: boolean,         // Initial auth state resolution
  isAuthenticated: boolean  // Computed from user && role
}
```

### 4. Index Route (`app/index.tsx`)

**Changes**:
- **Removed auth listener**: No longer listens to Firebase auth directly
- **Simplified**: Just renders LoginScreen
- **AuthGate handles redirects**: Authenticated users are redirected by AuthGate

### 5. Protected Dashboards

**Role Guards Added**:
- **Admin Dashboard**: Checks `role === 'admin'`, redirects if not
- **Teacher Dashboard**: Checks `role === 'teacher'`, redirects if not  
- **Student Dashboard**: Checks `role === 'student'`, redirects if not

**Query Guards**:
- All Firestore queries check `user?.uid` before execution
- Prevents queries from running without authentication
- Loading states handled gracefully

## Route Protection

### Role-Based Access Control

| Route Pattern | Allowed Roles |
|--------------|---------------|
| `/admin/*`   | `admin` only  |
| `/teacher/*` | `teacher` only |
| `/student/*` | `student` only |
| `/`, `/register` | Public (unauthenticated) |

### Protection Flow

1. **User navigates to protected route** (e.g., `/admin/dashboard`)
2. **AuthGate checks**:
   - Is user authenticated?
   - Does user role match route?
3. **If unauthorized**:
   - Redirects to login (`/`) if not authenticated
   - Redirects to user's dashboard if wrong role
4. **If authorized**:
   - Allows navigation
   - Renders protected screen

## Web/PWA Reload Safety

### Firebase Auth Persistence
- **Web**: Uses `browserLocalPersistence` (localStorage)
- **Native**: Uses `getReactNativePersistence(AsyncStorage)`
- Auth state survives page reloads on web

### Firestore Offline Persistence
- **Web**: Uses `persistentLocalCache` with `persistentMultipleTabManager`
- **Native**: Uses `persistentLocalCache`
- Data cached in IndexedDB (web) or native storage
- Queries return cached data immediately, sync with server in background

### Redux State
- Redux state is ephemeral (not persisted)
- Redux is synced from Firebase Auth on every app start
- This ensures Firebase Auth is always the source of truth

## Security Measures

### 1. Route Protection
- Direct URL access to protected routes is blocked
- AuthGate intercepts all navigation attempts
- Unauthorized users are redirected before screen renders

### 2. Query Protection
- All Firestore queries check `user?.uid` before execution
- Dashboards check role before loading data
- Prevents data leakage from unauthenticated queries

### 3. Role Validation
- User role is validated against Firestore document
- Invalid or missing roles result in logout
- Route access is strictly enforced

## Key Design Decisions

### Why Firebase Auth as Source of Truth?

1. **Reliability**: Firebase Auth state persists across reloads
2. **Security**: Auth state is managed by Firebase, not client-side
3. **Simplicity**: Single source reduces state synchronization issues
4. **Redux sync**: Redux is just a cache, synced from Firebase

### Why AuthGate Above Router?

1. **Centralized**: All auth logic in one place
2. **Early protection**: Route protection happens before screen renders
3. **No duplication**: No auth listeners in individual screens
4. **Consistent**: All routes follow same protection rules

### Why Block Rendering Until Auth Resolved?

1. **Prevents flash**: No brief display of wrong screen
2. **Race conditions**: Prevents queries from running before auth ready
3. **Security**: Ensures protection is active before any content renders
4. **UX**: Smooth loading experience with spinner

### Why No Redux Persistence?

1. **Firebase is source of truth**: Redux is just a cache
2. **Simpler**: No need to sync two persistent stores
3. **Reliability**: Firebase auth state is more reliable than Redux persistence
4. **Web safety**: Firebase handles persistence correctly on web

## Testing Checklist

- [ ] Reload page on web - auth state persists
- [ ] Direct URL access to `/admin/dashboard` without auth - redirects to login
- [ ] Admin user accesses `/teacher/dashboard` - redirects to admin dashboard
- [ ] Teacher user accesses `/admin/dashboard` - redirects to teacher dashboard
- [ ] Logout clears auth state and redirects to login
- [ ] Protected screens don't query Firestore without `user.uid`
- [ ] Role guards prevent unauthorized access

## Migration Notes

### Breaking Changes
- Removed `setUser(null)` - use `clearUser()` instead
- Removed auth listeners from screens - handled by AuthGate
- Route protection now enforced at layout level

### Migration Steps
1. ✅ AuthGate component created
2. ✅ RootLayout updated with AuthGate
3. ✅ AuthSlice updated (no setUser(null))
4. ✅ Index route simplified (no auth listener)
5. ✅ Dashboards updated with role guards
6. ✅ Firebase config updated for web persistence

## Future Improvements

1. **Auth state refresh**: Periodic check for role changes
2. **Session timeout**: Automatic logout after inactivity
3. **Token refresh**: Handle Firebase auth token expiration
4. **Offline queue**: Queue mutations when offline
