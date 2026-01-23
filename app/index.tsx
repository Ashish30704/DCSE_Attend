/**
 * Index Route - Login Screen
 * 
 * This is the entry point for unauthenticated users.
 * Auth state is managed by AuthGate in _layout.tsx.
 * No auth listeners here - AuthGate handles all auth state.
 */

// Polyfills required by Firebase web SDK in React Native / Expo
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import LoginScreen from './screens/LoginScreen';

interface RootState {
  auth: {
    user: any;
    role: string | null;
    loading: boolean;
    isAuthenticated: boolean;
  };
}

export default function Index() {
  const router = useRouter();
  const { user } = useSelector((state: RootState) => state.auth);
  const notificationListener = useRef<ReturnType<typeof Notifications.addNotificationReceivedListener> | null>(null);
  const responseListener = useRef<ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null>(null);

  // Set up notification listeners (only for authenticated users)
  useEffect(() => {
    if (!user) return;

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Index] Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[Index] Notification response:', response);
      const data = response.notification.request.content.data;
      // Navigate based on notification data
      if (data?.type === 'attendance' && user?.role === 'student') {
        router.push('/student/notifications');
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user?.role, router]);

  // Simply show login screen
  // AuthGate will handle redirecting authenticated users to their dashboards
  return <LoginScreen />;
}
