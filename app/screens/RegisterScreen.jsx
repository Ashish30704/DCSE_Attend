import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch } from "react-redux";
import { useErrorModal } from "../components/ErrorModal";
import { Input } from "../components/ui/Input";
import {
  GradientBackground,
  PrimaryButton,
  SecondaryButton,
} from "../components/ui/kit";
import { registerUser } from "../firebase/authService";
import { setUser } from "../redux/slices/authSlice";
import { isValidIndianPhone, toStoredPhone } from "../utils/phoneUtils";

const RegisterScreen = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    rollNo: "",
    phone: "",
    role: "teacher",
  });
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const router = useRouter();
  const { showError } = useErrorModal();

  const handleRegister = async () => {
    const { name, email, password, confirmPassword, rollNo, phone, role } =
      formData;

    if (!name || !email || !password) {
      showError("Please fill in name, email, and password", {
        title: "Missing Information",
      });
      return;
    }
    if (role === "student" && !rollNo) {
      showError("Roll number is required for student registration", {
        title: "Missing Information",
      });
      return;
    }

    if (password !== confirmPassword) {
      showError("Passwords do not match", { title: "Password mismatch" });
      return;
    }

    if (password.length < 6) {
      showError("Password must be at least 6 characters", {
        title: "Weak password",
      });
      return;
    }
    if (phone && !isValidIndianPhone(phone)) {
      showError("Please enter a valid 10-digit phone number", {
        title: "Invalid phone",
      });
      return;
    }

    setLoading(true);
    try {
      const userData = {
        name,
        rollNo: role === "student" ? rollNo : undefined,
        // email: email.trim(),
        phone: phone ? toStoredPhone(phone) : "",
        role,
        department: "DCSE",
      };

      const user = await registerUser(email, password, userData);
      dispatch(setUser(user));

      if (user.role === "admin") router.replace("/admin/dashboard");
      else if (user.role === "teacher") router.replace("/teacher/dashboard");
      else if (user.role === "student") router.replace("/student/dashboard");
      else router.replace("/");
    } catch (error) {
      showError(error.message || "Could not create account", {
        title: "Registration Failed",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateField = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const roleOptions = [
    { key: "teacher", label: "Teacher" },
    { key: "admin", label: "Admin" },
    { key: "student", label: "Student" },
  ];

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="flex-grow max-w-content w-full mx-auto px-4 py-8 lg:py-12"
        >
          <View className="items-center mb-6">
            <View
              className="w-20 h-20 rounded-2xl overflow-hidden bg-white border border-neutral-200 mb-5"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 6,
                elevation: 3,
              }}
            >
              <Image
                source={require("../../assets/images/mainLogo.jpeg")}
                style={{ width: 80, height: 80 }}
                resizeMode="cover"
              />
            </View>
            <Text className="text-2xl font-bold text-neutral-900 mb-2">
              Create an account
            </Text>
            <Text className="text-center text-sm text-neutral-500 max-w-[280px]">
              Access classes, attendance, and student records from a single
              dashboard
            </Text>
          </View>

          <View
            className="rounded-2xl bg-white border border-neutral-200 p-6"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Text className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
              Register as
            </Text>
            <View className="flex-row gap-2 mb-6">
              {roleOptions.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => updateField("role", option.key)}
                  className={
                    "flex-1 rounded-xl py-3 border-2 " +
                    (formData.role === option.key
                      ? "bg-primary-600 border-primary-600"
                      : "bg-neutral-50 border-neutral-200")
                  }
                >
                  <Text
                    className={
                      "text-center text-sm font-semibold " +
                      (formData.role === option.key
                        ? "text-white"
                        : "text-neutral-700")
                    }
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Full name"
              value={formData.name}
              onChangeText={(v) => updateField("name", v)}
              placeholder="Jane Doe"
            />
            {formData.role === "student" && (
              <Input
                label="Roll Number"
                value={formData.rollNo}
                onChangeText={(v) => updateField("rollNo", v)}
                placeholder="1"
                keyboardType="numeric"
              />
            )}
            <Input
              label="Email"
              value={formData.email}
              onChangeText={(v) => updateField("email", v)}
              placeholder="your@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label="Phone"
              value={formData.phone}
              onChangeText={(v) =>
                updateField("phone", v.replace(/\D/g, "").slice(0, 10))
              }
              placeholder="10-digit number"
              keyboardType="phone-pad"
              maxLength={10}
            />
            <Input
              label="Password"
              value={formData.password}
              onChangeText={(v) => updateField("password", v)}
              placeholder="Create a password"
              secureTextEntry
            />
            <Input
              label="Confirm Password"
              value={formData.confirmPassword}
              onChangeText={(v) => updateField("confirmPassword", v)}
              placeholder="Re-enter password"
              secureTextEntry
            />

            <PrimaryButton
              title="Create account"
              onPress={handleRegister}
              loading={loading}
              fullWidth
            />

            <View className="items-center mt-6 pt-5 border-t border-neutral-100">
              <Text className="text-neutral-500 text-sm mb-3">
                Already on the platform?
              </Text>
              <SecondaryButton
                title="Back to login"
                onPress={() => router.back()}
                fullWidth
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
};

export default RegisterScreen;
