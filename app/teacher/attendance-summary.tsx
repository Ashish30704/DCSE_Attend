import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import { GlassCard, GradientBackground, ScrollContainer } from '../components/ui/kit';
import { queryCollection } from '../firebase/firestoreService';
import { getCurrentSession } from '../firebase/sessionService';

type RootState = {
  auth: {
    user: {
      uid?: string;
      name?: string;
    } | null;
  };
};

type StudentDoc = {
  id?: string;
  studentId: string;
  name: string;
  email?: string;
  phone?: string;
  rollNo?: string;
  rollNumber?: string;
  classId?: string;
};

type ClassDoc = {
  id: string;
  name: string;
  section?: string;
  students?: StudentDoc[];
};

type AttendanceDoc = {
  classId?: string;
  students?: Record<string, boolean>;
};

type StudentAttendance = {
  studentId: string;
  name: string;
  classId: string;
  classLabel: string;
  presents: number;
  total: number;
  percent: number;
};

const AttendanceSummaryScreen = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [studentSummaries, setStudentSummaries] = useState<StudentAttendance[]>([]);
  const [classFilters, setClassFilters] = useState<{ id: string; label: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.uid) {
      loadSummary();
    }
  }, [user?.uid]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const classes = (await queryCollection('classes')) as ClassDoc[];
      const currentSession = await getCurrentSession();
      
      // Load all students from Firebase
      const allStudents = await queryCollection(
        'students',
        where('sessionId', '==', currentSession?.id)
      ) as StudentDoc[];
      
      const attendanceRecords = (await queryCollection('attendance')) as AttendanceDoc[];

      const classMap = new Map<string, string>();
      const initialStats = new Map<string, StudentAttendance>();

      classes.forEach((cls) => {
        if (!cls?.id) return;
        const label = cls.section ? `${cls.name} • ${cls.section}` : cls.name;
        classMap.set(cls.id, label);
      });
      
      // Initialize stats from students collection
      allStudents.forEach((student) => {
        if (!student.studentId || !student.classId) return;
        const classLabel = classMap.get(student.classId) || 'Unknown Class';
        initialStats.set(student.studentId, {
          studentId: student.studentId,
          name: student.name,
          classId: student.classId,
          classLabel: classLabel,
          presents: 0,
          total: 0,
          percent: 0,
        });
      });

      attendanceRecords.forEach((record) => {
        // Handle new format with presentStudents/absentStudents arrays
        if (record.presentStudents && Array.isArray(record.presentStudents)) {
          const presentRollNos = new Set(record.presentStudents);
          allStudents.forEach((student) => {
            const rollNo = student.rollNo || student.rollNumber;
            if (!rollNo || !student.studentId) return;
            const stat = initialStats.get(student.studentId);
            if (!stat) return;
            stat.total += 1;
            if (presentRollNos.has(rollNo)) {
              stat.presents += 1;
            }
            stat.percent = stat.total ? Math.round((stat.presents / stat.total) * 100) : 0;
          });
        } else {
          // Legacy format with students object
          Object.entries(record.students || {}).forEach(([studentId, present]) => {
            const stat = initialStats.get(studentId);
            if (!stat) return;
            stat.total += 1;
            if (present) stat.presents += 1;
            stat.percent = stat.total ? Math.round((stat.presents / stat.total) * 100) : 0;
          });
        }
      });

      const summaries = Array.from(initialStats.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      const filters = Array.from(classMap.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([id, label]) => ({ id, label }));

      setStudentSummaries(summaries);
      setClassFilters(filters);
    } catch (error) {
      console.error('Failed to load attendance summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSummaries = useMemo(() => {
    if (selectedClass === 'all') return studentSummaries;
    return studentSummaries.filter((student) => student.classId === selectedClass);
  }, [studentSummaries, selectedClass]);

  const groupedByClass = useMemo(() => {
    return filteredSummaries.reduce<Record<string, StudentAttendance[]>>((acc, student) => {
      if (!acc[student.classId]) {
        acc[student.classId] = [];
      }
      acc[student.classId].push(student);
      return acc;
    }, {});
  }, [filteredSummaries]);

  const totalStudents = studentSummaries.length;
  const lowAttendanceCount = studentSummaries.filter((student) => student.percent < 75).length;

  if (loading) {
    return (
      <GradientBackground>
        <View className="flex-1 items-center justify-center gap-4">
          <ActivityIndicator size="large" color="#2563eb" />
          <Text className="text-gray-600 font-medium">Calculating attendance trends...</Text>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground padded={false}>
      <ScrollContainer contentClassName="px-4 sm:px-6 pt-12 pb-16 gap-6">
        <View className="flex-row items-center justify-between">
          <Link href="/teacher/dashboard" asChild>
            <TouchableOpacity className="flex-row items-center gap-2 px-3 py-2 rounded-2xl bg-white/90 border border-blue-100 shadow-sm">
              <Ionicons name="chevron-back" size={16} color="#2563eb" />
              <Text className="text-sm font-semibold text-blue-600">Back to dashboard</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <GlassCard className="p-6 bg-blue-200 text-white">
          <Text className="text-gray-600 text-xs uppercase tracking-[0.4em] mb-3">DCSE Insight</Text>
          <Text className="text-3xl font-bold text-gray-800">Attendance Snapshot</Text>
          <Text className="text-gray-700 mt-2">
            Review student participation across every class in one place.
          </Text>
          <View className="flex-row gap-4 mt-6">
            <View className="flex-1 bg-gray-100 rounded-2xl p-4 border border-gray-200">
              <Text className="text-black text-sm">Total Students</Text>
              <Text className="text-gray-700 text-2xl font-semibold mt-1">{totalStudents}</Text>
            </View>
            <View className="flex-1 bg-gray-100 rounded-2xl p-4 border border-gray-200">
              <Text className="text-zinc-700 text-sm">Below 75%</Text>
              <Text className="text-rose-700 text-2xl font-semibold mt-1">{lowAttendanceCount}</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard className="p-5">
          <Text className="text-sm font-semibold text-gray-700 mb-3">Filter by class</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 32 }}>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setSelectedClass('all')}
                className={`px-4 py-2 rounded-full border flex-row items-center gap-2 ${
                  selectedClass === 'all' ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'
                }`}
              >
                <Ionicons name="apps" size={16} color={selectedClass === 'all' ? '#fff' : '#6b7280'} />
                <Text className={selectedClass === 'all' ? 'text-white font-semibold' : 'text-gray-700 font-semibold'}>
                  All Classes
                </Text>
              </TouchableOpacity>
              {classFilters.map((cls) => (
                <TouchableOpacity
                  key={cls.id}
                  onPress={() => setSelectedClass(cls.id)}
                  className={`px-4 py-2 rounded-full border flex-row items-center gap-2 ${
                    selectedClass === cls.id ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'
                  }`}
                >
                  <Ionicons name="school" size={16} color={selectedClass === cls.id ? '#fff' : '#6b7280'} />
                  <Text className={selectedClass === cls.id ? 'text-white font-semibold' : 'text-gray-700 font-semibold'}>
                    {cls.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </GlassCard>

        {Object.keys(groupedByClass).length === 0 ? (
          <GlassCard className="p-8 items-center">
            <Ionicons name="information-circle-outline" size={36} color="#94a3b8" />
            <Text className="mt-3 text-gray-500 font-medium text-center">
              No attendance data available for this filter.
            </Text>
          </GlassCard>
        ) : (
          Object.entries(groupedByClass).map(([classId, students]) => {
            const classLabel = classFilters.find((cls) => cls.id === classId)?.label ?? 'Unknown Class';
            const lowStudents = students.filter((student) => student.percent < 75);
            const healthyStudents = students.length - lowStudents.length;

            return (
              <GlassCard key={classId} className="p-0 overflow-hidden shadow-2xl shadow-blue-100 border border-blue-50">
                <View className="bg-blue-500 px-6 py-5">
                  <Text className="text-white text-xl font-semibold">{classLabel}</Text>
                  <Text className="text-white/70 text-sm">{students.length} students tracked</Text>
                  <View className="flex-row gap-3 mt-4">
                    <View className="bg-white/25 rounded-2xl px-3 py-2">
                      <Text className="text-white/70 text-xs uppercase">Healthy</Text>
                      <Text className="text-white text-lg font-semibold">{healthyStudents}</Text>
                    </View>
                    <View className="bg-rose-500/20 rounded-2xl px-3 py-2 border border-rose-300">
                      <Text className="text-white/80 text-xs uppercase">Below 75%</Text>
                      <Text className="text-white text-lg font-semibold">{lowStudents.length}</Text>
                    </View>
                  </View>
                </View>

                <View className="p-5 gap-5">
                  {lowStudents.length > 0 && (
                    <View>
                      <View className="flex-row items-center gap-2 mb-3">
                        <Ionicons name="alert-circle" size={18} color="#dc2626" />
                        <Text className="text-rose-500 font-semibold">Students needing attention ({lowStudents.length})</Text>
                      </View>
                      <View className="bg-rose-50 rounded-2xl border border-rose-100">
                        {lowStudents.map((student) => (
                          <View
                            key={student.studentId}
                            className="flex-row items-center justify-between px-4 py-3 border-b border-rose-100 last:border-b-0"
                          >
                            <View className="flex-row items-center gap-3">
                              <Ionicons name="person-circle-outline" size={22} color="#dc2626" />
                              <Text className="text-rose-600 font-semibold">{student.name}</Text>
                            </View>
                            <View className="px-3 py-1 rounded-full bg-rose-200">
                              <Text className="text-rose-600 font-semibold text-sm">{student.percent}%</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  <View>
                    <View className="flex-row items-center gap-2 mb-3">
                      <Ionicons name="people" size={18} color="#2563eb" />
                      <Text className="text-blue-700 font-semibold">All students in this class</Text>
                    </View>
                    <View className="gap-2">
                      {students.map((student) => (
                        <View
                          key={student.studentId}
                          className={`flex-row items-center justify-between px-4 py-3 rounded-2xl border ${
                            student.percent < 75 ? 'bg-rose-50 border-rose-200' : 'bg-blue-50 border-blue-200'
                          }`}
                        >
                          <View className="flex-row items-center gap-3 flex-1">
                            <Ionicons
                              name={student.percent < 75 ? 'trending-down' : 'checkmark-circle'}
                              size={18}
                              color={student.percent < 75 ? '#dc2626' : '#2563eb'}
                            />
                            <Text className={`font-semibold flex-1 ${student.percent < 75 ? 'text-rose-700' : 'text-blue-900'}`}>
                              {student.name}
                            </Text>
                          </View>
                          <View className={`px-3 py-1 rounded-full ${student.percent < 75 ? 'bg-rose-200' : 'bg-blue-200'}`}>
                            <Text
                              className={`text-sm font-semibold ${student.percent < 75 ? 'text-rose-800' : 'text-blue-800'}`}
                            >
                              {student.percent}%
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </GlassCard>
            );
          })
        )}
      </ScrollContainer>
    </GradientBackground>
  );
};

export default AttendanceSummaryScreen;

