import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { where } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { DepartmentLogo } from '../components/DepartmentLogo';
import { useErrorModal } from '../components/ErrorModal';
import { ScreenSkeleton } from '../components/ui';
import { GlassCard, GradientBackground, ScrollContainer, StatCard } from '../components/ui/kit';
import { logoutUser } from '../firebase/authService';
import { queryCollection, queryCollectionWithLimit } from '../firebase/firestoreService';
import { getCurrentSession } from '../firebase/sessionService';
import { clearUser } from '../redux/slices/authSlice';

type Student = {
  studentId?: string;
  name?: string;
  email?: string;
  phone?: string;
  rollNo?: string;
  rollNumber?: string;
  classId?: string;
};

type AttendanceDoc = {
  id?: string;
  classId?: string;
  subjectId?: string;
  date?: string;
  presentStudents?: string[];
  absentStudents?: string[];
};

type SubjectDoc = {
  id?: string;
  name?: string;
  code?: string;
};

type ClassDoc = {
  id?: string;
  name?: string;
  section?: string;
};

const StudentDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalSubjects: 0, attendanceRecords: 0 });
  const [studentData, setStudentData] = useState<Student | null>(null);
  const [classData, setClassData] = useState<ClassDoc | null>(null);
  const router = useRouter();
  const dispatch = useDispatch();
  const { user, role } = useSelector((state: any) => state.auth);
  const { showConfirm } = useErrorModal();

  // Role guard: Redirect non-student users
  useEffect(() => {
    if (!loading && role !== 'student') {
      router.replace('/');
    }
  }, [role, loading, router]);

  const registerPushNotifications = useCallback(async () => {
    if (!user?.uid || role !== 'student') return;
    try {
      const { registerForPushNotificationsAsync } = await import('../utils/pushNotifications');
      const token = await registerForPushNotificationsAsync(user.uid);
      if (token) {
        console.log('[StudentDashboard] Push notifications registered successfully');
      } else {
        console.warn('[StudentDashboard] Push notification registration returned no token');
      }
    } catch (error) {
      console.error('[StudentDashboard] Error registering for push notifications:', error);
    }
  }, [user?.uid, role]);

  const loadData = useCallback(async () => {
    if (!user?.uid || role !== 'student') {
      setLoading(false);
      return;
    }

    try {
      const currentSession = await getCurrentSession();
      const { getDocument } = await import('../firebase/firestoreService');

      // Find student by uid first
      let studentsList = await queryCollection(
        'students',
        where('uid', '==', user.uid)
      ) as Student[];

      // Fallback: if no student by uid, try by rollNo from user doc (e.g. after registration before sync)
      if (studentsList.length === 0 && (user as any).rollNo) {
        const byRoll = await queryCollection(
          'students',
          where('rollNo', '==', String((user as any).rollNo).trim())
        ) as Student[];
        if (byRoll.length > 0) {
          studentsList = byRoll;
        }
      }

      // Merge user profile so we always have name, email, rollNo for display
      const userProfile = {
        name: user.name,
        email: user.email,
        rollNo: (user as any).rollNo,
        phone: (user as any).phone,
      };

      if (studentsList.length === 0) {
        setStudentData({ ...userProfile, id: undefined } as Student);
        setLoading(false);
        return;
      }

      const student = studentsList[0];
      setStudentData({ ...userProfile, ...student });

      if (student.classId) {
        const classDoc = await getDocument('classes', student.classId) as ClassDoc | null;
        setClassData(classDoc);
      }

      if (student.classId) {
        const subjectsList = await queryCollection(
          'subjects',
          where('classId', '==', student.classId)
        ) as SubjectDoc[];
        setStats((prev) => ({ ...prev, totalSubjects: subjectsList.length }));
      }

      const rollNo = student.rollNo || student.rollNumber || (user as any).rollNo;
      if (rollNo && student.classId) {
        // Cap reads: dashboard only needs an approximate count (scalable vs full session history).
        const ATTENDANCE_CAP = 1000;
        const attendanceList = (await queryCollectionWithLimit(
          'attendance',
          ATTENDANCE_CAP,
          where('classId', '==', student.classId),
          where('sessionId', '==', currentSession?.id),
        )) as AttendanceDoc[];

        const studentAttendance = attendanceList.filter(att => {
          const present = att.presentStudents?.includes(String(rollNo)) || false;
          const absent = att.absentStudents?.includes(String(rollNo)) || false;
          return present || absent;
        });

        setStats(prev => ({ ...prev, attendanceRecords: studentAttendance.length }));
      }
    } catch (error) {
      console.error('Error loading student data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, role]);

  useEffect(() => {
    if (user?.uid && role === 'student') {
      void loadData();
      void registerPushNotifications();
    } else {
      setLoading(false);
    }
  }, [user?.uid, role, loadData, registerPushNotifications]);

  const handleLogout = useCallback(() => {
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
  }, [showConfirm, dispatch, router]);

  const classLine = useMemo(() => {
    if (classData) return `${classData.name} ${classData.section || ''}`.trim();
    if (studentData?.classId) return 'Loading…';
    return 'Not assigned';
  }, [classData, studentData?.classId]);

  if (loading) {
    return (
      <GradientBackground>
        <ScreenSkeleton rows={5} />
      </GradientBackground>
    );
  }

  return (
    <GradientBackground padded={false}>
      <ScrollContainer contentClassName="px-4 sm:px-6 lg:px-8 pt-4 pb-12 gap-6 max-w-wide w-full mx-auto">
        <View className="mb-4 gap-2">
          <View className="flex-row items-center justify-between gap-3">
            <DepartmentLogo size={64} />
            <View className="flex-1 min-w-0">
              <Text className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-0.5">Welcome back</Text>
              <Text className="text-xl font-bold text-neutral-900" numberOfLines={1}>{user?.name || studentData?.name || 'Student'}</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} className="rounded-xl border border-neutral-200 px-4 py-2.5 bg-white flex-row items-center gap-2 shrink-0">
              <Ionicons name="log-out-outline" size={18} color="#52525b" />
              <Text className="text-sm font-semibold text-neutral-700">Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Personal info: compact block */}
        <GlassCard className="p-4">
          <View className="flex-row">
          <View className="flex-1">
              <Text className="text-xs text-neutral-500 mb-0.5">Department</Text>
              <Text className="text-sm font-semibold text-neutral-900" numberOfLines={1}>{(user as any)?.department || 'DCSE'}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-xs text-neutral-500 mb-0.5">Role</Text>
              <Text className="text-sm font-semibold text-neutral-900">Student</Text>
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
            label="Class"
            value={classLine}
            icon={<Ionicons name="school-outline" size={20} color="#2563eb" />}
            accent="bg-primary-50"
          />
          <StatCard
            label="Subjects"
            value={stats.totalSubjects}
            icon={<Ionicons name="book-outline" size={20} color="#059669" />}
            accent="bg-emerald-50"
          />
        </View>

        <GlassCard className="p-5">
          <TouchableOpacity onPress={() => router.push('/student/assignments')} activeOpacity={0.8} className="flex-row items-center justify-between mb-4 py-1">
            <View className="flex-row items-center gap-4 flex-1 min-w-0">
              <View className="w-12 h-12 rounded-xl items-center justify-center bg-amber-50">
                <Ionicons name="document-text-outline" size={22} color="#d97706" />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-base font-semibold text-neutral-900">Assignments</Text>
                <Text className="text-sm text-neutral-500">View by subject</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#a1a1aa" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/student/notifications')} activeOpacity={0.8} className="flex-row items-center justify-between py-1">
            <View className="flex-row items-center gap-4 flex-1 min-w-0">
              <View className="w-12 h-12 rounded-xl items-center justify-center bg-purple-50">
                <Ionicons name="notifications-outline" size={22} color="#7c3aed" />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-base font-semibold text-neutral-900">Notifications</Text>
                <Text className="text-sm text-neutral-500">Push enabled</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#a1a1aa" />
          </TouchableOpacity>
        </GlassCard>

        <GlassCard className="p-5">
          <TouchableOpacity onPress={() => router.push('/student/attendance')} activeOpacity={0.8} className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-4 flex-1 min-w-0">
              <View className="w-12 h-12 rounded-xl items-center justify-center bg-primary-50">
                <Ionicons name="calendar-outline" size={22} color="#2563eb" />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-base font-semibold text-neutral-900">View attendance</Text>
                <Text className="text-sm text-neutral-500">By subject and date</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#a1a1aa" />
          </TouchableOpacity>
        </GlassCard>
      </ScrollContainer>
    </GradientBackground>
  );
};

export default StudentDashboard;
