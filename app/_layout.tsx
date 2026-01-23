/**
 * RootLayout with Production-Safe Authentication
 * 
 * Architecture:
 * - AuthGate wraps the entire app and handles Firebase auth state
 * - Firebase Auth is the single source of truth
 * - Redux is synced exactly once from Firebase in AuthGate
 * - Route protection is enforced before rendering protected screens
 * - No auth listeners in individual screens
 */

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import { store } from "./redux/store";
import { AuthGate } from "./components/AuthGate";
import { ErrorModalProvider } from "./components/ErrorModal";
import "../global.css";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <AuthGate>
          <ErrorModalProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              {/* Public routes */}
              <Stack.Screen name="index" options={{ title: "Home" }}/>
              <Stack.Screen name="register" options={{ title: "Register" }}/>
              
              {/* Admin routes - protected by AuthGate */}
              <Stack.Screen name="admin/dashboard" options={{ title: "Admin Dashboard" }}/>
              <Stack.Screen name="admin/teachers" options={{ title: "Manage Teachers" }}/>
              <Stack.Screen name="admin/classes" options={{ title: "Manage Classes" }}/>
              <Stack.Screen name="admin/subjects" options={{ title: "Manage Subjects" }}/>
              <Stack.Screen name="admin/students" options={{ title: "Manage Students" }}/>
              <Stack.Screen name="admin/class-students" options={{ title: "Manage Students" }}/>
              
              {/* Teacher routes - protected by AuthGate */}
              <Stack.Screen name="teacher/dashboard" options={{ title: "Teacher Dashboard" }}/>
              <Stack.Screen name="teacher/attendance" options={{ title: "Attendance" }}/>
              <Stack.Screen name="teacher/attendance-summary" options={{ title: "Attendance Summary" }}/>
              <Stack.Screen name="teacher/attendance-matrix" options={{ title: "Attendance Matrix" }}/>
              <Stack.Screen name="teacher/attendance-export" options={{ title: "Attendance Excel" }}/>
              
              {/* Student routes - protected by AuthGate */}
              <Stack.Screen name="student/dashboard" options={{ title: "Student Dashboard" }}/>
              <Stack.Screen name="student/attendance" options={{ title: "My Attendance" }}/>
              <Stack.Screen name="student/notifications" options={{ title: "Notifications" }}/>
            </Stack>
          </ErrorModalProvider>
        </AuthGate>
      </Provider>
    </SafeAreaProvider>
  );
}
