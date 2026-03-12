/**
 * AuthGate Component
 * 
 * Production-safe authentication gate that:
 * - Uses Firebase Auth as the single source of truth
 * - Blocks rendering until auth state is resolved
 * - Syncs Redux state exactly once from Firebase
 * - Handles role-based route protection
 * - Prevents Firestore queries before auth is ready
 */

import { useRouter, useSegments } from 'expo-router';
import { User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { onAuthStateChanged } from '../firebase/authService';
import { getDocument } from '../firebase/firestoreService';
import { clearUser, setLoading, setUser } from '../redux/slices/authSlice';

interface RootState {
  auth: {
    user: any;
    role: string | null;
    loading: boolean;
    isAuthenticated: boolean;
  };
}

// Role-based route protection mapping
const ROLE_ROUTES: Record<string, string[]> = {
  admin: ['admin'],
  teacher: ['teacher'],
  student: ['student'],
};

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['index', 'register', 'forgot-password'];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const dispatch = useDispatch();
  const router = useRouter();
  const segments = useSegments();
  const { user, role, loading } = useSelector((state: RootState) => state.auth);

  // Sync Firebase Auth state to Redux
  // Firebase Auth is the single source of truth - Redux is synced on every auth state change
  useEffect(() => {
    let isMounted = true;
    let isFirstLoad = true;

    // Subscribe to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(async (authUser: User | null) => {
      if (!isMounted) return;

      if (authUser) {
        try {
          const userData = await getDocument('users', authUser.uid);
          if (userData && userData.role) {
            dispatch(setUser({
              uid: authUser.uid,
              ...userData,
              emailVerified: authUser.emailVerified,
            }));
          } else {
            console.warn('[AuthGate] User document missing or invalid');
            dispatch(clearUser());
          }
        } catch (error) {
          console.error('[AuthGate] Error fetching user data:', error);
          dispatch(clearUser());
        }
      } else {
        // No authenticated user
        dispatch(clearUser());
      }

      // Mark as initialized after first auth state resolution
      if (isMounted && isFirstLoad) {
        isFirstLoad = false;
        setInitializing(false);
        dispatch(setLoading(false));
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []); // Run only once on mount

  // Handle route protection based on user role and email verification
  useEffect(() => {
    if (initializing || loading) return;

    const currentRoute = segments[0];
    const inPublic = segments[0] === '(auth)' || PUBLIC_ROUTES.includes(currentRoute || '');

    if (!user || !role) {
      if (!inPublic) router.replace('/');
      return;
    }

    const allowedRoutes = ROLE_ROUTES[role] || [];
    const isAdminOnAttendanceSummary = role === 'admin' && currentRoute === 'teacher' && segments[1] === 'attendance-summary';
    const isAllowedRoute = isAdminOnAttendanceSummary || allowedRoutes.some((r) => currentRoute?.startsWith(r));

    if (!PUBLIC_ROUTES.includes(currentRoute || '')) {
      if (!isAllowedRoute) {
        if (role === 'admin') router.replace('/admin/dashboard');
        else if (role === 'teacher') router.replace('/teacher/dashboard');
        else if (role === 'student') router.replace('/student/dashboard');
        else router.replace('/');
        return;
      }
    }

    if (inPublic && PUBLIC_ROUTES.includes(currentRoute || '')) {
      if (role === 'admin') router.replace('/admin/dashboard');
      else if (role === 'teacher') router.replace('/teacher/dashboard');
      else if (role === 'student') router.replace('/student/dashboard');
    }
  }, [user, role, segments, initializing, loading, router]);

  // Block rendering until auth state is resolved
  if (initializing || loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return <>{children}</>;
}