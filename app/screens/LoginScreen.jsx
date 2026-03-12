import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useDispatch } from "react-redux";
import { useErrorModal } from "../components/ErrorModal";
import { GradientBackground, PrimaryButton, SecondaryButton } from "../components/ui/kit";
import { Input } from "../components/ui/Input";
import { loginUser } from "../firebase/authService";
import { setUser } from "../redux/slices/authSlice";

const roleOptions = [
  { key: "teacher", label: "Teacher" },
  { key: "student", label: "Student" },
  { key: "admin", label: "Admin" },
];

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("teacher");
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const router = useRouter();
  const { showError } = useErrorModal();

  const handleLogin = async () => {
    if (!email?.trim() || !password) {
      showError("Please fill in all fields", { title: "Missing Information" });
      return;
    }
    setLoading(true);
    try {
      const user = await loginUser(email.trim(), password);
      if (user.role !== role) {
        showError(`This account is registered as ${user.role}, not ${role}`, { title: "Role mismatch" });
        setLoading(false);
        return;
      }
      dispatch(setUser(user));
      if (role === "admin") router.replace("/admin/dashboard");
      else if (role === "teacher") router.replace("/teacher/dashboard");
      else if (role === "student") router.replace("/student/dashboard");
      else router.replace("/");
    } catch (error) {
      showError(error.message || "Invalid email or password", { title: "Login Failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <GradientBackground>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="flex-grow justify-center max-w-content w-full mx-auto px-4 py-10 lg:py-16"
        >
          <View className="items-center mb-8">
            <View className="w-20 h-20 rounded-2xl overflow-hidden bg-white border border-neutral-200 mb-5" style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 }}>
              <Image source={require("../../assets/images/mainLogo.jpeg")} style={{ width: 80, height: 80 }} resizeMode="cover" />
            </View>
            <Text className="text-2xl font-bold text-neutral-900 mb-2">Welcome back</Text>
            <Text className="text-center text-sm text-neutral-500 max-w-[280px]">
              Sign in to manage schedules, attendance, and records
            </Text>
          </View>

          <View className="rounded-2xl bg-white border border-neutral-200 p-6" style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }}>
            <Text className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Sign in as</Text>
            <View className="flex-row gap-2 mb-6">
              {roleOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setRole(opt.key)}
                  className={"flex-1 rounded-xl py-3 border-2 " + (role === opt.key ? "bg-primary-600 border-primary-600" : "bg-neutral-50 border-neutral-200")}
                >
                  <Text className={"text-center text-sm font-semibold " + (role === opt.key ? "text-white" : "text-neutral-700")}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input label="Email" value={email} onChangeText={setEmail} placeholder="your@email.com" keyboardType="email-address" autoCapitalize="none" />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
            />
            <TouchableOpacity onPress={() => router.push("/forgot-password")} className="mb-5 self-end">
              <Text className="text-primary-600 text-sm font-medium">Forgot password?</Text>
            </TouchableOpacity>

            <PrimaryButton title="Sign in" onPress={handleLogin} loading={loading} fullWidth />

            <View className="items-center mt-6 pt-5 border-t border-neutral-100">
              <Text className="text-neutral-500 text-sm mb-3">New to the portal?</Text>
              <SecondaryButton title="Create an account" onPress={() => router.push("/register")} fullWidth />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}
