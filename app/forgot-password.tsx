import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useErrorModal } from "./components/ErrorModal";
import { GradientBackground, PrimaryButton, SecondaryButton } from "./components/ui/kit";
import { Input } from "./components/ui/Input";
import { sendPasswordReset } from "./firebase/authService";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();
  const { showError } = useErrorModal();

  const handleSendReset = async () => {
    if (!email?.trim()) {
      showError("Please enter your email address.", { title: "Missing email" });
      return;
    }
    setLoading(true);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (error) {
      showError(error.message || "Could not send reset email.", { title: "Reset failed" });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <GradientBackground>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="flex-grow justify-center max-w-content w-full mx-auto px-4 py-10"
          >
            <View className="items-center mb-8">
              <View className="w-16 h-16 rounded-2xl bg-emerald-500 items-center justify-center mb-5">
                <Ionicons name="mail-open-outline" size={28} color="#fff" />
              </View>
              <Text className="text-2xl font-bold text-neutral-900 mb-2">Check your email</Text>
              <Text className="text-center text-sm text-neutral-600 mb-2">
                We sent a password reset link to{" "}
                <Text className="font-semibold">{email}</Text>. Open that email and use the link to set a new password.
              </Text>
              <Text className="text-center text-xs text-neutral-500">
                The email is from Firebase (noreply). If you don’t see it in a few minutes, check spam or use “Send reset link” again.
              </Text>
            </View>
            <View className="rounded-2xl bg-white border border-neutral-200 p-6" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }}>
              <SecondaryButton title="Back to login" onPress={() => router.replace("/")} fullWidth />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="flex-grow justify-center max-w-content w-full mx-auto px-4 py-10"
        >
          <View className="items-center mb-8">
            <View className="w-16 h-16 rounded-2xl bg-primary-600 items-center justify-center mb-5">
              <Ionicons name="key-outline" size={28} color="#fff" />
            </View>
            <Text className="text-2xl font-bold text-neutral-900 mb-2">Forgot password?</Text>
            <Text className="text-center text-sm text-neutral-500 max-w-[300px]">
              Enter your email. You will receive an email with a link to reset your password (from Firebase/noreply). It may take a minute—check spam if you don’t see it.
            </Text>
          </View>

          <View className="rounded-2xl bg-white border border-neutral-200 p-6" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }}>
            <Input label="Email" value={email} onChangeText={setEmail} placeholder="your@email.com" keyboardType="email-address" autoCapitalize="none" />
            <PrimaryButton title="Send reset link" onPress={handleSendReset} loading={loading} fullWidth />
            <TouchableOpacity onPress={() => router.back()} className="mt-5 py-2 items-center">
              <Text className="text-primary-600 font-medium">Back to login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}
