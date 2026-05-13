/**
 * RootLayout with Production-Safe Authentication
 *
 * Architecture:
 * - AuthGate wraps the entire app and handles Firebase auth state
 * - Firebase Auth is the single source of truth
 * - Redux is synced exactly once from Firebase in AuthGate
 * - Route protection is enforced before rendering protected screens
 * - No auth listeners in individual screens
 *
 * Icon fonts (Ionicons) are preloaded here so they render correctly on web
 * (Firebase Hosting). We also call Ionicons.loadFont() on web because
 * useFonts can fail or race on static export; rendering before the font
 * loads shows cross/tofu placeholders.
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import "../global.css";
import { AuthGate } from "./components/AuthGate";
import { ErrorModalProvider } from "./components/ErrorModal";
import { store } from "./redux/store";

void SplashScreen.preventAutoHideAsync();

const layoutStyle = { flex: 1, maxWidth: "100%", overflow: "hidden" as const };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ ...Ionicons.font });
  const [webFontFallback, setWebFontFallback] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    let cancelled = false;
    Ionicons.loadFont()
      .then(() => {
        if (!cancelled) setWebFontFallback(true);
      })
      .catch((e) => {
        console.warn("[RootLayout] Ionicons.loadFont:", e);
        if (!cancelled) setWebFontFallback(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (fontError) {
      console.warn("[RootLayout] useFonts reported an error:", fontError);
    }
  }, [fontError]);

  const fontsReady =
    fontsLoaded || (Platform.OS === "web" && webFontFallback);

  useEffect(() => {
    if (fontsReady) {
      void SplashScreen.hideAsync();
    }
  }, [fontsReady]);

  if (!fontsReady) {
    return <View style={{ flex: 1, backgroundColor: "#f8fafc" }} />;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={layoutStyle}>
        <Provider store={store}>
          <AuthGate>
            <ErrorModalProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false, freezeOnBlur: true }}>
                {/* Public routes */}
                <Stack.Screen name="index" options={{ title: "Home" }} />
                <Stack.Screen name="register" options={{ title: "Register" }} />
                <Stack.Screen
                  name="forgot-password"
                  options={{ title: "Forgot Password" }}
                />
                <Stack.Screen
                  name="verify-email"
                  options={{ title: "Verify Email" }}
                />

                {/* Admin routes - protected by AuthGate */}
                <Stack.Screen
                  name="admin/dashboard"
                  options={{ title: "Admin Dashboard" }}
                />
                <Stack.Screen
                  name="admin/teachers"
                  options={{ title: "Manage Teachers" }}
                />
                <Stack.Screen
                  name="admin/classes"
                  options={{ title: "Manage Classes" }}
                />
                <Stack.Screen
                  name="admin/subjects"
                  options={{ title: "Manage Subjects" }}
                />
                <Stack.Screen
                  name="admin/students"
                  options={{ title: "Manage Students" }}
                />
                <Stack.Screen
                  name="admin/class-students"
                  options={{ title: "Manage Students" }}
                />

                {/* Teacher routes - protected by AuthGate */}
                <Stack.Screen
                  name="teacher/dashboard"
                  options={{ title: "Teacher Dashboard" }}
                />
                <Stack.Screen
                  name="teacher/subject"
                  options={{ title: "Subject" }}
                />
                <Stack.Screen
                  name="teacher/assignment-marks"
                  options={{ title: "Enter marks" }}
                />
                <Stack.Screen
                  name="teacher/attendance"
                  options={{ title: "Attendance" }}
                />
                <Stack.Screen
                  name="teacher/attendance-summary"
                  options={{ title: "Attendance Summary" }}
                />
                <Stack.Screen
                  name="teacher/attendance-matrix"
                  options={{ title: "Attendance Matrix" }}
                />
                <Stack.Screen
                  name="teacher/attendance-export"
                  options={{ title: "Attendance Excel" }}
                />

                {/* Student routes - protected by AuthGate */}
                <Stack.Screen
                  name="student/dashboard"
                  options={{ title: "Student Dashboard" }}
                />
                <Stack.Screen
                  name="student/assignments"
                  options={{ title: "Assignments" }}
                />
                <Stack.Screen
                  name="student/attendance"
                  options={{ title: "My Attendance" }}
                />
                <Stack.Screen
                  name="student/notifications"
                  options={{ title: "Notifications" }}
                />
              </Stack>
            </ErrorModalProvider>
          </AuthGate>
        </Provider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
