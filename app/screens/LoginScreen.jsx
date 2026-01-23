import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useErrorModal } from '../components/ErrorModal';
import { GlassCard, GradientBackground, PrimaryButton, SecondaryButton } from '../components/ui/kit';
import { loginUser } from '../firebase/authService';
import { setUser } from '../redux/slices/authSlice';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('teacher'); // 'admin', 'teacher', or 'student'
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const router = useRouter();
  const { showError } = useErrorModal();

  const handleLogin = async () => {
    if (!email || !password) {
      showError('Please fill in all fields', { title: 'Missing Information' });
      return;
    }

    setLoading(true);
    try {
      const user = await loginUser(email, password);
      
      // Verify role matches
      if (user.role !== role) {
        showError(`This account is registered as ${user.role}, not ${role}`, { title: 'Role mismatch' });
        setLoading(false);
        return;
      }

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
      showError(error.message || 'Invalid email or password', { title: 'Login Failed' });
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    { key: 'teacher', label: 'Teacher' },
    { key: 'admin', label: 'Admin' },
    { key: 'student', label: 'Student' },
  ];

  return (
    <GradientBackground>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="flex-grow justify-center max-w-md w-full mx-auto px-4 py-8">
          <View className="items-center mb-8">
            <View className="w-14 h-14 rounded-xl p-2 bg-blue-600 items-center justify-center mb-4">
              <Ionicons name="school-outline" size={24} color="#fff" />
            </View>
            <Text className="text-2xl font-bold text-gray-900 mb-2">Welcome back</Text>
            <Text className="text-center text-sm text-gray-600">Sign in to manage schedules, attendance, and records</Text>
          </View>

          <GlassCard className="p-5">
            <View className="mb-5">
              <Text className="text-xs uppercase tracking-wide text-gray-500 mb-3">Sign in as</Text>
              <View className="flex-row gap-2">
                {roleOptions.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => setRole(option.key)}
                    className={`flex-1 rounded-lg border py-2 ${
                      role === option.key ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
                    }`}
                  >
                    <Text className={`text-center text-sm font-semibold ${role === option.key ? 'text-white' : 'text-gray-700'}`}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@dcse.edu"
                keyboardType="email-address"
                autoCapitalize="none"
                className="w-full py-3 px-4 rounded-lg bg-gray-50 border border-gray-300 text-gray-900"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View className="mb-5">
              <Text className="text-sm font-semibold text-gray-700 mb-2">Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                secureTextEntry
                className="w-full py-3 px-4 rounded-lg bg-gray-50 border border-gray-300 text-gray-900"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <PrimaryButton title="Login" onPress={handleLogin} loading={loading} />

            <View className="items-center gap-2 mt-5">
              <Text className="text-gray-500 text-sm">New to the portal?</Text>
              <SecondaryButton title="Create an account" onPress={() => router.push('/register')} />
            </View>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
};

export default LoginScreen;
