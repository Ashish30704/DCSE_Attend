import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useErrorModal } from '../components/ErrorModal';
import { GlassCard, GradientBackground, PillTag, ScrollContainer } from '../components/ui/kit';
import { logoutUser } from '../firebase/authService';
import { getDocument, queryCollection } from '../firebase/firestoreService';
import { getCurrentSession } from '../firebase/sessionService';
import { clearUser } from '../redux/slices/authSlice';

// Component to display student count from Firebase
const ClassStudentCount = ({ classId }: { classId: string }) => {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCount = async () => {
      try {
        const currentSession = await getCurrentSession();
        const studentsList = await queryCollection(
          'students',
          where('classId', '==', classId),
          where('sessionId', '==', currentSession?.id)
        );
        setCount(studentsList.length);
      } catch (error) {
        console.error('Error loading student count:', error);
      } finally {
        setLoading(false);
      }
    };
    if (classId) {
      loadCount();
    }
  }, [classId]);

  if (loading) {
    return <Text className="text-gray-500 mt-1 text-sm">Loading...</Text>;
  }
  return <Text className="text-gray-500 mt-1 text-sm">{count} students</Text>;
};

const TeacherDashboard = () => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const dispatch = useDispatch();
  const { user, role } = useSelector((state: any) => state.auth);
  const { showError, showConfirm } = useErrorModal();

  // Role guard: Redirect non-teacher users
  useEffect(() => {
    if (!loading && role !== 'teacher') {
      router.replace('/');
    }
  }, [role, loading, router]);

  useEffect(() => {
    // Guard: Only load data if user is authenticated and is teacher
    if (user?.uid && role === 'teacher') {
      loadClasses();
    } else {
      setLoading(false);
    }
  }, [user?.uid, role]);

  const loadClasses = async () => {
    // Double guard: Prevent queries without user.uid and ensure teacher role
    if (!user?.uid || role !== 'teacher') {
      setLoading(false);
      return;
    }
    try {
      const teachers = await queryCollection('teachers', where('uid', '==', user?.uid));
      const teacherDocId = teachers.length > 0 ? teachers[0].id : null;
      const teacherUid = user?.uid;

      const classQueryPromises = [];
      if (teacherDocId) {
        classQueryPromises.push(queryCollection('classes', where('inchargeTeacherId', '==', teacherDocId)));
        classQueryPromises.push(queryCollection('classes', where('teacherId', '==', teacherDocId)));
      }
      if (teacherUid) {
        classQueryPromises.push(queryCollection('classes', where('inchargeTeacherUid', '==', teacherUid)));
        classQueryPromises.push(queryCollection('classes', where('teacherId', '==', teacherUid)));
      }

      const classResults = (await Promise.all(classQueryPromises)).flat();
      const classesMap = new Map();
      classResults.forEach((cls) => {
        if (cls?.id) {
          classesMap.set(cls.id, cls);
        }
      });

      const subjectQueryPromises = [];
      if (teacherDocId) {
        subjectQueryPromises.push(queryCollection('subjects', where('subjectTeacherId', '==', teacherDocId)));
        subjectQueryPromises.push(queryCollection('subjects', where('teacherId', '==', teacherDocId)));
      }
      if (teacherUid) {
        subjectQueryPromises.push(queryCollection('subjects', where('subjectTeacherUid', '==', teacherUid)));
        subjectQueryPromises.push(queryCollection('subjects', where('teacherId', '==', teacherUid)));
      }

      const subjectResults = (await Promise.all(subjectQueryPromises)).flat();
      const subjectsMap = new Map();
      subjectResults.forEach((subj) => {
        if (subj?.id) {
          subjectsMap.set(subj.id, subj);
        }
      });
      const subjectsForTeacher = Array.from(subjectsMap.values());

      const classIdsFromSubjects = Array.from(
        new Set(subjectsForTeacher.map((subject) => subject.classId).filter(Boolean))
      );

      const classesFromSubjects = await Promise.all(
        classIdsFromSubjects
          .filter((classId) => !classesMap.has(classId))
          .map(async (classId) => {
            const classData = await getDocument('classes', classId);
            return classData ? { id: classId, ...classData } : null;
          })
      );

      classesFromSubjects
        .filter(Boolean)
        .forEach((cls) => {
          classesMap.set(cls.id, cls);
        });

      const classesWithSubjects = Array.from(classesMap.values()).map((classItem) => {
        const filteredSubjects = subjectsForTeacher.filter((subject) => subject.classId === classItem.id);
        const isIncharge =
          (teacherDocId && classItem.inchargeTeacherId === teacherDocId) ||
          (teacherUid && classItem.inchargeTeacherUid === teacherUid) ||
          (teacherDocId && !classItem.inchargeTeacherId && classItem.teacherId === teacherDocId) ||
          (teacherUid && !classItem.inchargeTeacherUid && classItem.teacherId === teacherUid);

        return {
          ...classItem,
          subjects: filteredSubjects,
          assignmentType: isIncharge ? 'incharge' : 'subject',
        };
      });

      setClasses(classesWithSubjects);
    } catch (error) {
      console.error('Error loading classes:', error);
      showError('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
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
      <ScrollContainer contentClassName="px-4 sm:px-6 pt-6 pb-10 gap-5">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-1">
            <Text className="text-xs text-gray-500 uppercase tracking-wide mb-1">Welcome back</Text>
            <Text className="text-2xl font-bold text-gray-900">{user?.name || 'Teacher'}</Text>
            <Text className="text-sm text-gray-600 mt-1">ID: {user?.id || 'N/A'} • {user?.email || ''}</Text>
          </View>
          <TouchableOpacity
            onPress={handleLogout}
            className="rounded-xl border border-gray-300 px-4 py-2.5 bg-white flex-row items-center gap-2"
          >
            <Ionicons name="log-out-outline" size={16} color="#374151" />
            <Text className="text-sm font-semibold text-gray-700 py-2">Logout</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/teacher/attendance-summary')}
          className="bg-blue-600 rounded-xl py-3 items-center flex-row justify-center gap-2"
          activeOpacity={0.8}
        >
          <Ionicons name="bar-chart-outline" size={18} color="#fff" />
          <Text className="text-white font-semibold text-sm">View Attendance Summary</Text>
        </TouchableOpacity>

        {classes.length === 0 ? (
          <GlassCard className="p-6">
            <Text className="text-center text-gray-500 text-lg">No classes assigned yet</Text>
          </GlassCard>
        ) : (
          classes.map((classItem) => (
            <GlassCard key={classItem.id} className="p-4">
              <View className="flex-row items-start justify-between mb-3">
                <View className="flex-1">
                  <Text className="text-lg font-bold text-gray-900">
                    {classItem.name} • {classItem.section}
                  </Text>
                  <ClassStudentCount classId={classItem.id} />
                </View>
                <PillTag
                  text={classItem.assignmentType === 'incharge' ? 'Incharge' : 'Subject'}
                  variant="outline"
                />
              </View>

              {classItem.assignmentType === 'incharge' && (
                <TouchableOpacity
                  onPress={() => router.push(`/teacher/attendance-matrix?classId=${classItem.id}`)}
                  className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 flex-row items-center justify-between"
                  activeOpacity={0.7}
                >
                  <View className="flex-row py-2 items-center gap-2">
                    <Ionicons name="grid-outline" size={16} color="#2563eb" />
                    <Text className="text-sm font-semibold text-blue-700">Attendance Matrix</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#2563eb" />
                </TouchableOpacity>
              )}

              {classItem.subjects && classItem.subjects.length > 0 ? (
                <View className="gap-2">
                  {classItem.subjects.map((subject) => (
                    <TouchableOpacity
                      key={subject.id}
                      onPress={() => router.push(`/teacher/attendance?classId=${classItem.id}&subjectId=${subject.id}`)}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 flex-row items-center justify-between"
                      activeOpacity={0.7}
                    >
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-gray-900">{subject.name}</Text>
                        <Text className="text-xs text-gray-500 mt-0.5">Code: {subject.code || 'N/A'}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text className="text-gray-500 text-sm">No subjects assigned</Text>
              )}
            </GlassCard>
          ))
        )}
      </ScrollContainer>
    </GradientBackground>
  );
};

export default TeacherDashboard;

