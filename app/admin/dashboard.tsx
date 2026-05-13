import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { DepartmentLogo } from '../components/DepartmentLogo';
import { useErrorModal } from '../components/ErrorModal';
import { loginUser, logoutUser } from '../firebase/authService';
import { getCollection } from '../firebase/firestoreService';
import { getCurrentSession, resetSession } from '../firebase/sessionService';
import { clearUser } from '../redux/slices/authSlice';
import { GlassCard, GradientBackground, ScrollContainer, StatCard } from '../components/ui/kit';

const AdminDashboard = () => {
  const [stats, setStats] = useState({ teachers: 0, classes: 0, students: 0 });
  const [loading, setLoading] = useState(true);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch();
  const { user, role } = useSelector((state: any) => state.auth);
  const { showConfirm, showError, showSuccess } = useErrorModal();

  useEffect(() => {
    if (!loading && role !== 'admin') {
      router.replace('/');
    }
  }, [role, loading, router]);

  useEffect(() => {
    if (user?.uid && role === 'admin') {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user?.uid, role]);

  const loadData = async () => {
    if (!user?.uid || role !== 'admin') {
      setLoading(false);
      return;
    }

    try {
      const teachers = await getCollection('teachers');
      const classes = await getCollection('classes');
      const students = await getCollection('students');
      const totalStudents = classes.reduce((sum, cls) => sum + (cls.students?.length || 0), 0);
      setStats({
        teachers: teachers.length,
        classes: classes.length,
        students: students.length || totalStudents,
      });

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

  const handleArchiveSession = async () => {
    if (!newSessionName.trim()) {
      showError('Please enter a name for the new session.', { title: 'Validation' });
      return;
    }
    if (!adminPassword.trim()) {
      showError('Enter your admin password to confirm.', { title: 'Password required' });
      return;
    }
    if (!user?.email) {
      showError('Admin email not found.', { title: 'Error' });
      return;
    }

    setResetting(true);
    try {
      await loginUser(user.email, adminPassword.trim());
      await resetSession(newSessionName.trim(), user.uid);
      showSuccess('Current session archived and a new active session was created in Firestore.', {
        title: 'Session updated',
      });
      setShowSessionModal(false);
      setNewSessionName('');
      setAdminPassword('');
      await loadData();
    } catch (e: any) {
      showError(e?.message || 'Could not update session.', { title: 'Error' });
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
              <Text className="text-xl font-bold text-neutral-900" numberOfLines={1}>
                {user?.name || 'Admin'}
              </Text>
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
                <Text className="text-xs text-primary-600 font-semibold mb-1 uppercase tracking-wide">
                  Current Session
                </Text>
                <Text className="text-lg font-bold text-neutral-900" numberOfLines={1}>
                  {currentSession.name}
                </Text>
                <Text className="text-xs text-neutral-500 mt-1">
                  Started:{' '}
                  {currentSession.startDate
                    ? new Date(currentSession.startDate).toLocaleDateString()
                    : 'N/A'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSessionModal(true)}
                className="rounded-xl bg-primary-600 px-4 py-2.5 flex-row items-center gap-2 shrink-0"
              >
                <Ionicons name="calendar-outline" size={18} color="#fff" />
                <Text className="text-white text-sm font-semibold">New session</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        <GlassCard className="p-4">
          <View className="flex-row">
            <View className="flex-1">
              <Text className="text-xs text-neutral-500 mb-0.5">Department</Text>
              <Text className="text-sm font-semibold text-neutral-900" numberOfLines={1}>
                {(user as any)?.department || 'DCSE'}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-xs text-neutral-500 mb-0.5">Role</Text>
              <Text className="text-sm font-semibold text-neutral-900">Admin</Text>
            </View>
          </View>
          <View className="flex-row mt-3 pt-3 border-t border-neutral-100">
            <View className="flex-1 pr-3">
              <Text className="text-xs text-neutral-500 mb-0.5">Email</Text>
              <Text className="text-sm font-semibold text-neutral-900" numberOfLines={1}>
                {user?.email || '—'}
              </Text>
            </View>
          </View>
        </GlassCard>

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
                  <Ionicons name={card.icon as any} size={20} color="#374151" />
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

        <Modal visible={showSessionModal} transparent animationType="fade" onRequestClose={() => setShowSessionModal(false)}>
          <View className="flex-1 bg-black/50 justify-center px-4">
            <View className="bg-white rounded-2xl p-5 max-w-md w-full self-center">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-bold text-neutral-900">Archive &amp; new session</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowSessionModal(false);
                    setNewSessionName('');
                    setAdminPassword('');
                  }}
                >
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <Text className="text-sm text-neutral-600 mb-4 leading-5">
                This only updates session documents in Firestore (no Cloud Function). It does not delete attendance,
                classes, or users. For a full wipe you would need a separate backend tool.
              </Text>
              <Text className="text-sm font-semibold text-neutral-800 mb-1">New session name</Text>
              <TextInput
                value={newSessionName}
                onChangeText={setNewSessionName}
                placeholder="e.g. 2026-2027"
                className="border border-neutral-200 rounded-xl bg-neutral-50 px-4 py-3 text-neutral-900 mb-4"
                placeholderTextColor="#9ca3af"
              />
              <Text className="text-sm font-semibold text-neutral-800 mb-1">Admin password</Text>
              <TextInput
                value={adminPassword}
                onChangeText={setAdminPassword}
                placeholder="Confirm with your password"
                secureTextEntry
                className="border border-neutral-200 rounded-xl bg-neutral-50 px-4 py-3 text-neutral-900 mb-4"
                placeholderTextColor="#9ca3af"
              />
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => {
                    setShowSessionModal(false);
                    setNewSessionName('');
                    setAdminPassword('');
                  }}
                  className="flex-1 bg-neutral-100 rounded-xl py-3 items-center"
                >
                  <Text className="font-semibold text-neutral-700">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleArchiveSession}
                  disabled={resetting}
                  className={`flex-1 rounded-xl py-3 items-center ${resetting ? 'bg-neutral-300' : 'bg-primary-600'}`}
                >
                  {resetting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="font-semibold text-white">Save</Text>
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
