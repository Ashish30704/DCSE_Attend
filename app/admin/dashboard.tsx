import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { DepartmentLogo } from '../components/DepartmentLogo';
import { useErrorModal } from '../components/ErrorModal';
import { GlassCard, GradientBackground, ScrollContainer, StatCard } from '../components/ui/kit';
import { loginUser, logoutUser } from '../firebase/authService';
import { getCollection } from '../firebase/firestoreService';
import { getCurrentSession, resetSession } from '../firebase/sessionService';
import { clearUser } from '../redux/slices/authSlice';

const AdminDashboard = () => {
  const [stats, setStats] = useState({ teachers: 0, classes: 0, students: 0 });
  const [loading, setLoading] = useState(true);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch();
  const { user, role } = useSelector((state: any) => state.auth);
  const { showConfirm, showError, showSuccess } = useErrorModal();

  // Role guard: Redirect non-admin users
  useEffect(() => {
    if (!loading && role !== 'admin') {
      router.replace('/');
    }
  }, [role, loading, router]);

  useEffect(() => {
    // Guard: Only load data if user is authenticated and is admin
    if (user?.uid && role === 'admin') {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user?.uid, role]);

  const loadData = async () => {
    // Double guard: Prevent queries without user.uid
    if (!user?.uid || role !== 'admin') {
      setLoading(false);
      return;
    }

    try {
      const teachers = await getCollection('teachers');
      const classes = await getCollection('classes');
      const students = await getCollection('students');
      const totalStudents = classes.reduce((sum, cls) => sum + (cls.students?.length || 0), 0);
      setStats({ teachers: teachers.length, classes: classes.length, students: students.length || totalStudents });
      
      const session = await getCurrentSession();
      setCurrentSession(session);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    showConfirm({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      confirmLabel: 'Logout',
      onConfirm: async () => {
        await logoutUser();
        dispatch(clearUser());
        router.replace('/');
      },
    });
  };

  const handleResetSession = async () => {
    if (!newSessionName.trim()) {
      showError('Please enter a session name', { title: 'Validation Error' });
      return;
    }

    if (!adminPassword.trim()) {
      showError('Please enter your admin password to confirm', { title: 'Password Required' });
      return;
    }

    setResetting(true);
    try {
      // Verify admin password before resetting session
      if (!user?.email) {
        throw new Error('Admin email not found');
      }

      try {
        await loginUser(user.email, adminPassword);
      } catch (authError: any) {
        throw new Error('Invalid admin password. Session reset cancelled.');
      }

      // Password verified, proceed with session reset
      await resetSession(newSessionName.trim(), user?.uid);
      showSuccess('Session reset successfully. All users will need to relogin.');
      setShowResetModal(false);
      setNewSessionName('');
      setAdminPassword('');
      await loadData();
    } catch (error: any) {
      showError(error.message || 'Failed to reset session', { title: 'Error' });
    } finally {
      setResetting(false);
    }
  };

  const actionCards = [
    {
      title: 'Manage Teachers',
      description: 'Onboard and update teaching staff',
      icon: 'people-outline',
      route: '/admin/teachers',
      accent: 'bg-rose-100 text-rose-700',
    },
    {
      title: 'Manage Classes',
      description: 'Create sections & assign incharges',
      icon: 'layers-outline',
      route: '/admin/classes',
      accent: 'bg-blue-100 text-blue-700',
    },
    {
      title: 'Manage Subjects',
      description: 'Link subjects to classes and teachers',
      icon: 'book-outline',
      route: '/admin/subjects',
      accent: 'bg-emerald-100 text-emerald-700',
    },
    {
      title: 'Manage Students',
      description: 'Import and export student data',
      icon: 'school-outline',
      route: '/admin/students',
      accent: 'bg-purple-100 text-purple-700',
    },
    {
      title: 'Attendance Summary',
      description: 'View attendance by class and subject',
      icon: 'bar-chart-outline',
      route: '/teacher/attendance-summary',
      accent: 'bg-sky-100 text-sky-700',
    },
  ];

  if (loading) {
    return (
      <GradientBackground>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground padded={false}>
      <ScrollContainer contentClassName="px-4 sm:px-6 pt-6 pb-12 gap-5">
        <View className="mb-4">
          <View className="flex-row items-center justify-between gap-3">
            <DepartmentLogo size={64} />
            <View className="flex-1 min-w-0">
              <Text className="text-xs text-neutral-500 uppercase tracking-wide mb-0.5">Welcome back</Text>
              <Text className="text-xl font-bold text-neutral-900" numberOfLines={1}>{user?.name || 'Admin'}</Text>
            </View>
            <TouchableOpacity
              onPress={handleLogout}
              className="rounded-xl border border-neutral-200 px-4 py-2.5 bg-white flex-row items-center gap-2 shrink-0"
            >
              <Ionicons name="log-out-outline" size={16} color="#374151" />
              <Text className="text-sm font-semibold text-neutral-700">Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {currentSession && (
          <GlassCard className="p-4 border-primary-200 bg-primary-50/50">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1 min-w-0">
                <Text className="text-xs text-primary-600 font-semibold mb-1 uppercase tracking-wide">Current Session</Text>
                <Text className="text-lg font-bold text-neutral-900" numberOfLines={1}>{currentSession.name}</Text>
                <Text className="text-xs text-neutral-500 mt-1">
                  Started: {currentSession.startDate ? new Date(currentSession.startDate).toLocaleDateString() : 'N/A'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowResetModal(true)}
                className="rounded-xl bg-red-600 px-4 py-2.5 flex-row items-center gap-2 shrink-0"
              >
                <Ionicons name="refresh-outline" size={16} color="#fff" />
                <Text className="text-white text-sm font-semibold">Reset</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* Personal info: compact block */}
        <GlassCard className="p-4">
          <View className="flex-row">
          <View className="flex-1">
              <Text className="text-xs text-neutral-500 mb-0.5">Department</Text>
              <Text className="text-sm font-semibold text-neutral-900" numberOfLines={1}>{(user as any)?.department || 'DCSE'}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-xs text-neutral-500 mb-0.5">Role</Text>
              <Text className="text-sm font-semibold text-neutral-900">Admin</Text>
            </View>
          </View>
          <View className="flex-row mt-3 pt-3 border-t border-neutral-100">
            
            <View className="flex-1 pr-3">
              <Text className="text-xs text-neutral-500 mb-0.5">Email</Text>
              <Text className="text-sm font-semibold text-neutral-900" numberOfLines={1}>{user?.email || '—'}</Text>
            </View>
          </View>
        </GlassCard>

        {/* Non-personal: StatCards */}
        <View className="flex-row flex-wrap gap-3">
          <StatCard
            label="Teachers"
            value={stats.teachers}
            icon={<Ionicons name="person-outline" size={20} color="#2563eb" />}
            accent="bg-primary-50"
          />
          <StatCard
            label="Classes"
            value={stats.classes}
            icon={<Ionicons name="business-outline" size={20} color="#059669" />}
            accent="bg-emerald-50"
          />
          <StatCard
            label="Students"
            value={stats.students}
            icon={<Ionicons name="people-outline" size={20} color="#d97706" />}
            accent="bg-amber-50"
          />
        </View>

        <View className="gap-3">
          {actionCards.map((card) => (
            <GlassCard key={card.title} className="p-4">
              <TouchableOpacity
                onPress={() => router.push(card.route)}
                activeOpacity={0.8}
                className="flex-row items-center justify-between gap-3"
              >
                <View className={`w-10 h-10 rounded-xl items-center justify-center shrink-0 ${card.accent}`}>
                  <Ionicons name={card.icon} size={20} color="#374151" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-base font-semibold text-neutral-900">{card.title}</Text>
                  <Text className="text-sm text-neutral-500 mt-0.5">{card.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#a1a1aa" />
              </TouchableOpacity>
            </GlassCard>
          ))}
        </View>

        {/* Reset Session Modal */}
        <Modal
          visible={showResetModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowResetModal(false)}
        >
          <View className="flex-1 bg-black/50 justify-center px-4">
            <View className="bg-white rounded-2xl p-5">
              <View className="flex-row items-center justify-between mb-4">
                <View className="w-10 h-10 bg-red-100 rounded-xl items-center justify-center">
                  <Ionicons name="warning" size={20} color="#DC2626" />
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setShowResetModal(false);
                    setNewSessionName('');
                    setAdminPassword('');
                  }}
                  className="p-1"
                >
                  <Ionicons name="close" size={22} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <Text className="text-xl font-bold text-gray-900 mb-2">Reset Session</Text>
              <Text className="text-sm text-gray-600 mb-5">
                This will archive the current session and create a new one. Previous data will be preserved but a new session will start. All users will need to relogin.
              </Text>

              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">New Session Name *</Text>
                <TextInput
                  value={newSessionName}
                  onChangeText={setNewSessionName}
                  placeholder="e.g., 2025-2026"
                  className="bg-gray-50 px-4 py-3 rounded-lg border border-gray-300 text-gray-900"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">Admin Password *</Text>
                <TextInput
                  value={adminPassword}
                  onChangeText={setAdminPassword}
                  placeholder="Enter your admin password"
                  secureTextEntry
                  className="bg-gray-50 px-4 py-3 rounded-lg border border-gray-300 text-gray-900"
                  placeholderTextColor="#9ca3af"
                />
                <Text className="text-xs text-gray-500 mt-2">
                  Your password is required to confirm this action
                </Text>
              </View>

              <View className="flex-row gap-3 mt-2">
                <TouchableOpacity
                  onPress={() => {
                    setShowResetModal(false);
                    setNewSessionName('');
                    setAdminPassword('');
                  }}
                  className="flex-1 bg-gray-100 rounded-lg py-3 items-center"
                >
                  <Text className="text-gray-700 font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleResetSession}
                  disabled={resetting || !adminPassword.trim()}
                  className={`flex-1 rounded-lg py-3 items-center ${
                    resetting || !adminPassword.trim() ? 'bg-gray-400' : 'bg-red-600'
                  }`}
                >
                  {resetting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className="text-white font-semibold">Reset Session</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollContainer>
    </GradientBackground>
  );
};

export default AdminDashboard;
