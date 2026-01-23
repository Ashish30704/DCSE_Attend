import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useErrorModal } from '../components/ErrorModal';
import { GlassCard, GradientBackground, ScrollContainer, StatCard } from '../components/ui/kit';
import { logoutUser } from '../firebase/authService';
import { queryCollection } from '../firebase/firestoreService';
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
  const [subjects, setSubjects] = useState<SubjectDoc[]>([]);
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

  useEffect(() => {
    // Guard: Only load data if user is authenticated and is student
    if (user?.uid && role === 'student') {
      loadData();
      registerPushNotifications();
    } else {
      setLoading(false);
    }
  }, [user?.uid, role]);

  const registerPushNotifications = async () => {
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
  };

  const loadData = async () => {
    // Double guard: Prevent queries without user.uid and ensure student role
    if (!user?.uid || role !== 'student') {
      setLoading(false);
      return;
    }

    try {
      // Get current session
      const currentSession = await getCurrentSession();

      // Find student by uid
      const studentsList = await queryCollection(
        'students',
        where('uid', '==', user?.uid)
      ) as Student[];

      if (studentsList.length === 0) {
        console.error('Student not found');
        return;
      }

      const student = studentsList[0];
      setStudentData(student);

      // Get class data
      if (student.classId) {
        const { getDocument } = await import('../firebase/firestoreService');
        const classDoc = await getDocument('classes', student.classId) as ClassDoc | null;
        setClassData(classDoc);
      }

      // Get subjects for this class
      if (student.classId) {
        const subjectsList = await queryCollection(
          'subjects',
          where('classId', '==', student.classId)
        ) as SubjectDoc[];
        setSubjects(subjectsList);
        setStats(prev => ({ ...prev, totalSubjects: subjectsList.length }));
      }

      // Get attendance records for this student
      const rollNo = student.rollNo || student.rollNumber;
      if (rollNo && student.classId) {
        const attendanceList = await queryCollection(
          'attendance',
          where('classId', '==', student.classId),
          where('sessionId', '==', currentSession?.id)
        ) as AttendanceDoc[];

        // Filter attendance where student is present or absent
        const studentAttendance = attendanceList.filter(att => {
          const present = att.presentStudents?.includes(rollNo) || false;
          const absent = att.absentStudents?.includes(rollNo) || false;
          return present || absent;
        });

        setStats(prev => ({ ...prev, attendanceRecords: studentAttendance.length }));
      }
    } catch (error) {
      console.error('Error loading student data:', error);
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
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-1">
            <Text className="text-xs text-gray-500 uppercase tracking-wide mb-1">Welcome back</Text>
            <Text className="text-2xl font-bold text-gray-900">{user?.name || studentData?.name || 'Student'}</Text>
            <Text className="text-sm text-gray-600 mt-1">View your attendance records and academic information</Text>
          </View>
          <TouchableOpacity
            onPress={handleLogout}
            className="rounded-xl border border-gray-300 px-4 py-2 bg-white flex-row items-center gap-2"
          >
            <Ionicons name="log-out-outline" size={16} color="#374151" />
            <Text className="text-sm font-semibold text-gray-700">Logout</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row flex-wrap gap-3">
          <StatCard
            label="Class"
            value={classData ? `${classData.name} ${classData.section || ''}`.trim() : 'N/A'}
            icon={<Ionicons name="school-outline" size={20} color="#2563eb" />}
            accent="bg-blue-50"
          />
          <StatCard
            label="Subjects"
            value={stats.totalSubjects}
            icon={<Ionicons name="book-outline" size={20} color="#059669" />}
            accent="bg-emerald-50"
          />
          {/* <StatCard
            label="Records"
            value={stats.attendanceRecords}
            icon={<Ionicons name="calendar-outline" size={20} color="#d97706" />}
            accent="bg-amber-50"
          /> */}
        </View>

        <GlassCard className="p-4">
          <TouchableOpacity
            onPress={() => router.push('/student/notifications')}
            activeOpacity={0.7}
            className="flex-row items-center justify-between mb-3"
          >
            <View className="flex-row items-center gap-3 flex-1">
              <View className="w-10 h-10 rounded-xl items-center justify-center bg-purple-50">
                <Ionicons name="notifications-outline" size={20} color="#7c3aed" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900">Notifications</Text>
                <Text className="text-sm text-gray-500">Push notifications enabled</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </GlassCard>

        <GlassCard className="p-4">
          <TouchableOpacity
            onPress={() => router.push('/student/attendance')}
            activeOpacity={0.7}
            className="flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3 flex-1">
              <View className="w-10 h-10 rounded-xl items-center justify-center bg-blue-50">
                <Ionicons name="calendar-outline" size={20} color="#2563eb" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900">View Attendance</Text>
                <Text className="text-sm text-gray-500">View your attendance by subject and date</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </GlassCard>
      </ScrollContainer>
    </GradientBackground>
  );
};

export default StudentDashboard;
