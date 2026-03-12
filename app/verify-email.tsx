import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useErrorModal } from "./components/ErrorModal";
import { GradientBackground, PrimaryButton } from "./components/ui/kit";
import { logoutUser, reloadAuthUser, resendVerificationEmail } from "./firebase/authService";
import { clearUser, setUser } from "./redux/slices/authSlice";

export default function VerifyEmailScreen() {
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch();
  const { showError, showSuccess } = useErrorModal();
  const user = useSelector((state: { auth: { user: any } }) => state.auth.user);
  const role = useSelector((state: { auth: { role: string | null } }) => state.auth.role);
  const email = user?.email || "your email";

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerificationEmail();
      showSuccess("Verification email sent. Check your inbox (and spam folder).", { title: "Email sent" });
    } catch (e) {
      showError(e instanceof Error ? e.message : "Could not send email.", { title: "Error" });
    } finally {
      setResending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      dispatch(clearUser());
      router.replace("/");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Logout failed.", { title: "Error" });
    }
  };

  const handleIveVerified = async () => {
    setChecking(true);
    try {
      const updated = await reloadAuthUser();
      if (updated?.emailVerified && user) {
        dispatch(setUser({ ...user, emailVerified: true }));
        if (role === "admin") router.replace("/admin/dashboard");
        else if (role === "teacher") router.replace("/teacher/dashboard");
        else if (role === "student") router.replace("/student/dashboard");
        else router.replace("/");
      } else {
        showError("Email not verified yet. Click the link in the email we sent you, then try again.", { title: "Not verified" });
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : "Could not refresh.", { title: "Error" });
    } finally {
      setChecking(false);
    }
  };

  return (
    <GradientBackground>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="flex-grow justify-center max-w-content w-full mx-auto px-4 py-10"
        >
          <View className="items-center mb-8">
            <View className="w-16 h-16 rounded-2xl bg-amber-500 items-center justify-center mb-5">
              <Ionicons name="mail-unread-outline" size={28} color="#fff" />
            </View>
            <Text className="text-2xl font-bold text-neutral-900 mb-2">Verify your email</Text>
            <Text className="text-center text-sm text-neutral-600 mb-2">
              We sent a verification link to <Text className="font-semibold">{email}</Text>. Click that link to confirm this account.
            </Text>
            <Text className="text-center text-xs text-neutral-500">
              The email may take a minute to arrive. Check your spam folder if you don’t see it.
            </Text>
          </View>

          <View className="rounded-2xl bg-white border border-neutral-200 p-6 gap-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }}>
            <PrimaryButton title="Resend verification email" onPress={handleResend} loading={resending} fullWidth />
            <TouchableOpacity
              onPress={handleIveVerified}
              disabled={checking}
              className="py-3.5 rounded-2xl border-2 border-primary-600 items-center"
            >
              {checking ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <Text className="text-primary-600 font-semibold">I’ve verified — take me in</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleLogout} className="py-3 items-center">
              <Text className="text-neutral-500 font-medium">Log out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}
