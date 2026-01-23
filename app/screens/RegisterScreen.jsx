import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useErrorModal } from '../components/ErrorModal';
import { GlassCard, GradientBackground, PrimaryButton, SecondaryButton } from '../components/ui/kit';
import { registerUser } from '../firebase/authService';
import { setUser } from '../redux/slices/authSlice';

const Field = React.memo(({ label, required = false, ...inputProps }) => (
  <View className="mb-4">
    <Text className="text-sm font-semibold text-gray-700 mb-2">
      {label} {required && <Text className="text-red-500">*</Text>}
    </Text>
    <TextInput
      {...inputProps}
      className={`w-full py-3 px-4 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 ${
        inputProps.className || ''
      }`}
      placeholderTextColor="#9ca3af"
    />
  </View>
));

const RegisterScreen = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    id: '',
    rollNo: '',
    phone: '',
    role: 'teacher',
  });
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const router = useRouter();
  const { showError } = useErrorModal();

  const handleRegister = async () => {
    const { name, email, password, confirmPassword, id, rollNo, phone, role } = formData;

    // Validation based on role
    if (role === 'student') {
      if (!name || !email || !password || !rollNo) {
        showError('Please fill in all required fields', { title: 'Missing Information' });
        return;
      }
    } else {
      if (!name || !email || !password || !id) {
        showError('Please fill in all required fields', { title: 'Missing Information' });
        return;
      }
    }

    if (password !== confirmPassword) {
      showError('Passwords do not match', { title: 'Password mismatch' });
      return;
    }

    if (password.length < 6) {
      showError('Password must be at least 6 characters', { title: 'Weak password' });
      return;
    }

    setLoading(true);
    try {
      const userData = {
        name,
        id: role === 'student' ? undefined : id,
        rollNo: role === 'student' ? rollNo : undefined,
        phone: phone || '',
        role,
        department: 'DCSE',
      };

      const user = await registerUser(email, password, userData);
      dispatch(setUser(user));

      // Navigate based on role
      if (role === 'admin') {
        router.replace('/admin/dashboard');
      } else if (role === 'teacher') {
        router.replace('/teacher/dashboard');
      } else if (role === 'student') {
        router.replace('/student/dashboard');
      }
    } catch (error) {
      showError(error.message || 'Could not create account', { title: 'Registration Failed' });
    } finally {
      setLoading(false);
    }
  };

  const updateField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const roleOptions = [
    { key: 'teacher', label: 'Teacher' },
    { key: 'admin', label: 'Admin' },
    { key: 'student', label: 'Student' },
  ];

  return (
    <GradientBackground>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="flex-grow px-2 max-w-2xl w-full mx-auto py-6">
          <View className="items-center mb-6">
            <View className="w-14 h-14 rounded-xl p-2 bg-blue-600 items-center justify-center mb-4">
              <Ionicons name="person-add-outline" size={24} color="#fff" />
            </View>
            <Text className="text-2xl font-bold text-gray-900 mb-2">Create an account</Text>
            <Text className="text-center text-sm text-gray-600">
              Access classes, attendance, and student records from a single dashboard
            </Text>
          </View>

          <GlassCard className="p-5">
            <View className="mb-5">
              <Text className="text-xs uppercase tracking-wide text-gray-500 mb-3">Register as</Text>
              <View className="flex-row gap-2">
                {roleOptions.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => updateField('role', option.key)}
                    className={`flex-1 rounded-lg border py-2 ${
                      formData.role === option.key ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
                    }`}
                  >
                    <Text
                      className={`text-center text-sm font-semibold ${
                        formData.role === option.key ? 'text-white' : 'text-gray-700'
                      }`}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Field
                label="Full name"
                required
                value={formData.name}
                onChangeText={(value) => updateField('name', value)}
                placeholder="Jane Doe"
              />
              {formData.role === 'student' ? (
                <Field
                  label="Roll Number"
                  required
                  value={formData.rollNo}
                  onChangeText={(value) => updateField('rollNo', value)}
                  placeholder="1"
                  keyboardType="numeric"
                />
              ) : (
                <Field
                  label={formData.role === 'teacher' ? 'Teacher ID' : 'Admin ID'}
                  required
                  value={formData.id}
                  onChangeText={(value) => updateField('id', value)}
                  placeholder={formData.role === 'teacher' ? 'TCH-001' : 'ADM-001'}
                />
              )}
              <Field
                label="Institution email"
                required
                value={formData.email}
                onChangeText={(value) => updateField('email', value)}
                placeholder="you@dcse.edu"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Field
                label="Phone"
                value={formData.phone}
                onChangeText={(value) => updateField('phone', value)}
                placeholder="+91 9876543210"
                keyboardType="phone-pad"
              />
              <Field
                label="Password"
                required
                value={formData.password}
                onChangeText={(value) => updateField('password', value)}
                placeholder="Create a password"
                secureTextEntry
              />
              <Field
                label="Confirm Password"
                required
                value={formData.confirmPassword}
                onChangeText={(value) => updateField('confirmPassword', value)}
                placeholder="Re-enter password"
                secureTextEntry
              />
            </View>

            <PrimaryButton title="Create Account" onPress={handleRegister} loading={loading} />

            <View className="items-center gap-2 mt-5">
              <Text className="text-gray-500 text-sm">Already on the platform?</Text>
              <SecondaryButton title="Back to login" onPress={() => router.back()} />
            </View>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
};

export default RegisterScreen;

