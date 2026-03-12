import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useSelector } from 'react-redux';
import { useErrorModal } from '../components/ErrorModal';
import { GlassCard, GradientBackground, PillTag, ScrollContainer } from '../components/ui/kit';
import { getDocument, queryCollection } from '../firebase/firestoreService';
import { getCurrentSession } from '../firebase/sessionService';

type DateFilterMode = 'all' | 'single' | 'range';

type RootState = {
  auth: {
    user: {
      uid?: string;
      name?: string;
    } | null;
  };
};

type Student = {
  id?: string;
  name: string;
  rollNo?: string;
  rollNumber?: string;
};

type ClassDoc = {
  name?: string;
  section?: string;
  students?: Student[];
  inchargeTeacherUid?: string;
  inchargeTeacherId?: string;
  teacherId?: string;
};

type SubjectDoc = {
  id?: string;
  name?: string;
  code?: string;
  classId?: string;
};

type AttendanceDoc = {
  id?: string;
  classId?: string;
  subjectId?: string;
  date?: string;
  students?: Record<string, boolean>;
};

type StudentRow = {
  rollNo: string;
  name: string;
  totals: {
    totalClasses: number;
    presents: number;
    absents: number;
    percent: number;
  };
};

const AttendanceMatrixScreen = () => {
  const { classId } = useLocalSearchParams<{ classId?: string }>();
  const router = useRouter();
  const { user } = useSelector((state: RootState) => state.auth);
  const { showError } = useErrorModal();

  const [classData, setClassData] = useState<ClassDoc | null>(null);
  const [subjects, setSubjects] = useState<SubjectDoc[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | 'all'>('all');
  const [studentRows, setStudentRows] = useState<StudentRow[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<
    Record<
      string,
      Record<
        string,
        {
          total: number;
          present: number;
        }
      >
    >
  >({});
  const [loading, setLoading] = useState(true);

  // Date filter: all | single date | date range
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('all');
  const [singleDate, setSingleDate] = useState<string | null>(null);
  const [rangeFrom, setRangeFrom] = useState<string | null>(null);
  const [rangeTo, setRangeTo] = useState<string | null>(null);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [calendarMode, setCalendarMode] = useState<'single' | 'rangeFrom' | 'rangeTo'>('single');

  useEffect(() => {
    if (classId && user?.uid) {
      loadData();
    }
  }, [classId, user?.uid, selectedSubjectId]);

  const loadData = async () => {
    try {
      if (!classId) {
        showError('No class selected', { title: 'Error' });
        router.back();
        return;
      }

      const teacherDocs = user?.uid ? await queryCollection('teachers', where('uid', '==', user.uid)) : [];
      const teacherDocId = teacherDocs.length > 0 ? teacherDocs[0].id : null;

      const cls = (await getDocument('classes', classId)) as ClassDoc | null;

      if (!cls) {
        showError('Class not found', { title: 'Error' });
        router.back();
        return;
      }

      const isClassIncharge =
        (cls.inchargeTeacherUid && cls.inchargeTeacherUid === user?.uid) ||
        (teacherDocId && cls.inchargeTeacherId === teacherDocId) ||
        (!cls.inchargeTeacherUid &&
          ((teacherDocId && cls.teacherId === teacherDocId) || (user?.uid && cls.teacherId === user.uid)));

      if (!isClassIncharge) {
        showError('Only the class incharge can view the full class attendance matrix.', { title: 'Access Denied' });
        router.back();
        return;
      }

      setClassData(cls);

      // Load subjects for this class so incharge can filter per subject
      const subjectDocs = (await queryCollection(
        'subjects',
        where('classId', '==', classId)
      )) as SubjectDoc[];
      const sortedSubjects = subjectDocs
        .filter((s) => s.id)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setSubjects(sortedSubjects);

      const attendanceConstraints: any[] = [where('classId', '==', classId)];
      if (selectedSubjectId !== 'all') {
        attendanceConstraints.push(where('subjectId', '==', selectedSubjectId));
      }

      const attendanceList = (await queryCollection(
        'attendance',
        ...attendanceConstraints
      )) as AttendanceDoc[];

      const uniqueDates = Array.from(
        new Set(attendanceList.map((doc) => doc.date).filter((d): d is string => !!d)),
      ).sort();

      // Load students from Firebase students collection by classId
      const currentSession = await getCurrentSession();
      const studentsList = await queryCollection(
        'students',
        where('classId', '==', classId),
        where('sessionId', '==', currentSession?.id)
      ) as Student[];

      const matrixData: Record<string, Record<string, { total: number; present: number }>> = {};
      const totalsByStudent: Record<
        string,
        {
          total: number;
          present: number;
        }
      > = {};

      const getRollNo = (s: Student) => String(s?.rollNo ?? s?.rollNumber ?? s?.id ?? '').trim();
      studentsList.forEach((student) => {
        const rollNo = getRollNo(student);
        if (!rollNo) return;
        matrixData[rollNo] = {};
        totalsByStudent[rollNo] = { total: 0, present: 0 };
      });

      attendanceList.forEach((doc) => {
        if (!doc.date) return;
        if (doc.presentStudents || doc.absentStudents) {
          const presentRollNos = new Set((doc.presentStudents || []).map(String));
          studentsList.forEach((student) => {
            const rollNo = getRollNo(student);
            if (!rollNo || !matrixData[rollNo]) return;
            if (!matrixData[rollNo][doc.date!]) {
              matrixData[rollNo][doc.date!] = { total: 0, present: 0 };
            }
            matrixData[rollNo][doc.date!].total += 1;
            totalsByStudent[rollNo].total += 1;
            if (presentRollNos.has(rollNo)) {
              matrixData[rollNo][doc.date!].present += 1;
              totalsByStudent[rollNo].present += 1;
            }
          });
        }
      });

      const studentRowData: StudentRow[] = studentsList
        .filter((s) => getRollNo(s))
        .map((student) => {
          const rollNo = getRollNo(student);
          const totals = totalsByStudent[rollNo] || { total: 0, present: 0 };
          const totalClasses = totals.total;
          const presents = totals.present;
          const absents = Math.max(totalClasses - presents, 0);
          const percent = totalClasses ? Math.round((presents / totalClasses) * 100) : 0;
          return {
            rollNo,
            name: student.name,
            totals: { totalClasses, presents, absents, percent },
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      setStudentRows(studentRowData);
      setDates(uniqueDates);
      setMatrix(matrixData);
    } catch (error) {
      console.error('Failed to load attendance matrix:', error);
      showError('Failed to load attendance matrix', { title: 'Error' });
    } finally {
      setLoading(false);
    }
  };

  const totalDates = useMemo(() => dates.length, [dates]);

  const filteredDates = useMemo(() => {
    if (dateFilterMode === 'all') return dates;
    if (dateFilterMode === 'single') {
      if (!singleDate) return [];
      return dates.includes(singleDate) ? [singleDate] : [singleDate];
    }
    if (dateFilterMode === 'range') {
      if (!rangeFrom || !rangeTo) return [];
      return dates.filter((d) => d >= rangeFrom && d <= rangeTo);
    }
    return dates;
  }, [dates, dateFilterMode, singleDate, rangeFrom, rangeTo]);

  const filteredStudentRows = useMemo(() => {
    if (dateFilterMode === 'all' || filteredDates.length === 0) {
      if (dateFilterMode === 'all') return studentRows;
      return studentRows.map((row) => ({
        ...row,
        totals: { totalClasses: 0, presents: 0, absents: 0, percent: 0 },
      }));
    }
    return studentRows.map((row) => {
      let total = 0;
      let present = 0;
      filteredDates.forEach((date) => {
        const cell = matrix[row.rollNo]?.[date];
        if (cell) {
          total += cell.total;
          present += cell.present;
        }
      });
      const absents = Math.max(total - present, 0);
      const percent = total ? Math.round((present / total) * 100) : 0;
      return {
        ...row,
        totals: { totalClasses: total, presents: present, absents, percent },
      };
    });
  }, [studentRows, dateFilterMode, filteredDates, matrix]);

  if (loading) {
    return (
      <GradientBackground>
        <View className="flex-1 items-center justify-center gap-4">
          <ActivityIndicator size="large" color="#2563eb" />
          <Text className="text-gray-600 font-medium">Building class attendance matrix...</Text>
        </View>
      </GradientBackground>
    );
  }

  if (!classData) {
    return (
      <GradientBackground>
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-600 font-medium">No class data available.</Text>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground padded={false}>
      <ScrollContainer contentClassName="px-4 sm:px-6 pt-12 pb-16 gap-6">
        <View className="flex-row items-center justify-between mb-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row items-center gap-2 px-3 py-2 rounded-2xl bg-white/90 border border-blue-100 shadow-sm"
          >
            <Ionicons name="chevron-back" size={16} color="#2563eb" />
            <Text className="text-sm font-semibold text-blue-600">Back to dashboard</Text>
          </TouchableOpacity>
        </View>

        <GlassCard className="p-6 bg-blue-200 text-white">
          <Text className="text-gray-600 text-xs uppercase tracking-[0.4em] mb-3">Class Attendance</Text>
          <Text className="text-3xl font-bold text-gray-800">Attendance Matrix</Text>
          
          <View className="mt-4 flex-row gap-3 flex-wrap">
            <PillTag
              text={`${classData.name || 'Class'} • ${classData.section || ''}`}
              variant="solid"
            />
            <PillTag text={`${studentRows.length} students`} />
            <PillTag
              text={dateFilterMode === 'all' ? `${totalDates} attendance days` : `${filteredDates.length} day(s) selected`}
              variant="outline"
            />
          </View>
        </GlassCard>

        {/* Subject filter */}
        <GlassCard className="p-5">
          <Text className="text-sm font-semibold text-gray-700 mb-3">Filter by subject</Text>
          {subjects.length === 0 ? (
            <Text className="text-gray-500 text-sm">No subjects found for this class.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 32 }}>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setSelectedSubjectId('all')}
                  className={`px-4 py-2 rounded-full border flex-row items-center gap-2 ${
                    selectedSubjectId === 'all' ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'
                  }`}
                >
                  <Ionicons name="apps" size={16} color={selectedSubjectId === 'all' ? '#fff' : '#6b7280'} />
                  <Text
                    className={
                      selectedSubjectId === 'all' ? 'text-white font-semibold' : 'text-gray-700 font-semibold'
                    }
                  >
                    All Subjects
                  </Text>
                </TouchableOpacity>
                {subjects.map((subject) => (
                  <TouchableOpacity
                    key={subject.id}
                    onPress={() => setSelectedSubjectId(subject.id!)}
                    className={`px-4 py-2 rounded-full border flex-row items-center gap-2 ${
                      selectedSubjectId === subject.id ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'
                    }`}
                  >
                    <Ionicons
                      name="book-outline"
                      size={16}
                      color={selectedSubjectId === subject.id ? '#fff' : '#6b7280'}
                    />
                    <Text
                      className={
                        selectedSubjectId === subject.id ? 'text-white font-semibold' : 'text-gray-700 font-semibold'
                      }
                    >
                      {subject.name || 'Subject'} {subject.code ? `• ${subject.code}` : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </GlassCard>

        {/* Date filter */}
        <GlassCard className="p-5">
          <Text className="text-sm font-semibold text-gray-700 mb-3">Filter by date</Text>
          <View className="flex-row gap-2 justify-between mb-4">
            <TouchableOpacity
              onPress={() => {
                setDateFilterMode('all');
                setSingleDate(null);
                setRangeFrom(null);
                setRangeTo(null);
              }}
              className={`px-4 py-2 rounded-full border flex-row items-center gap-2 ${
                dateFilterMode === 'all' ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'
              }`}
            >
              <Ionicons name="calendar-outline" size={16} color={dateFilterMode === 'all' ? '#fff' : '#6b7280'} />
              <Text className={dateFilterMode === 'all' ? 'text-white font-semibold' : 'text-gray-700 font-semibold'}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDateFilterMode('single')}
              className={`px-4 py-2 rounded-full border flex-row items-center gap-2 ${
                dateFilterMode === 'single' ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'
              }`}
            >
              <Ionicons name="today-outline" size={16} color={dateFilterMode === 'single' ? '#fff' : '#6b7280'} />
              <Text className={dateFilterMode === 'single' ? 'text-white font-semibold' : 'text-gray-700 font-semibold'}>
                Single
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDateFilterMode('range')}
              className={`px-4 py-2 rounded-full border flex-row items-center gap-2 ${
                dateFilterMode === 'range' ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'
              }`}
            >
              <Ionicons name="calendar" size={16} color={dateFilterMode === 'range' ? '#fff' : '#6b7280'} />
              <Text className={dateFilterMode === 'range' ? 'text-white font-semibold' : 'text-gray-700 font-semibold'}>
                Range
              </Text>
            </TouchableOpacity>
          </View>

          {dateFilterMode === 'single' && (
            <TouchableOpacity
              onPress={() => {
                setCalendarMode('single');
                setCalendarModalOpen(true);
              }}
              className="flex-row items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
            >
              <Text className="text-sm text-gray-600">
                {singleDate ? singleDate : 'Select date'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#6b7280" />
            </TouchableOpacity>
          )}

          {dateFilterMode === 'range' && (
            <View className="gap-3">
              <TouchableOpacity
                onPress={() => {
                  setCalendarMode('rangeFrom');
                  setCalendarModalOpen(true);
                }}
                className="flex-row items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <Text className="text-sm text-gray-600">From: {rangeFrom || 'Select date'}</Text>
                <Ionicons name="chevron-forward" size={18} color="#6b7280" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setCalendarMode('rangeTo');
                  setCalendarModalOpen(true);
                }}
                className="flex-row items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <Text className="text-sm text-gray-600">To: {rangeTo || 'Select date'}</Text>
                <Ionicons name="chevron-forward" size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>
          )}

          {dateFilterMode !== 'all' && (filteredDates.length > 0 || dateFilterMode === 'single') && (
            <Text className="text-xs text-gray-500 mt-3">
              Showing {filteredDates.length} day{filteredDates.length !== 1 ? 's' : ''}
            </Text>
          )}
        </GlassCard>

        {/* Calendar modal for date pick */}
        <Modal
          visible={calendarModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setCalendarModalOpen(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setCalendarModalOpen(false)}
            className="flex-1 bg-black/50 justify-end"
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl p-4 pb-8">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-semibold text-gray-800">
                  {calendarMode === 'single' ? 'Select date' : calendarMode === 'rangeFrom' ? 'From date' : 'To date'}
                </Text>
                <TouchableOpacity onPress={() => setCalendarModalOpen(false)} className="p-2">
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <Calendar
                minDate={dates.length > 0 ? dates[0] : undefined}
                maxDate={dates.length > 0 ? dates[dates.length - 1] : undefined}
                markedDates={
                  calendarMode === 'single' && singleDate
                    ? { [singleDate]: { selected: true, selectedColor: '#2563eb' } }
                    : calendarMode === 'rangeFrom' && rangeFrom
                      ? { [rangeFrom]: { selected: true, selectedColor: '#2563eb' } }
                      : calendarMode === 'rangeTo' && rangeTo
                        ? { [rangeTo]: { selected: true, selectedColor: '#2563eb' } }
                        : {}
                }
                onDayPress={(day) => {
                  if (calendarMode === 'single') {
                    setSingleDate(day.dateString);
                    setCalendarModalOpen(false);
                  } else if (calendarMode === 'rangeFrom') {
                    setRangeFrom(day.dateString);
                    if (rangeTo && day.dateString > rangeTo) setRangeTo(day.dateString);
                    setCalendarModalOpen(false);
                  } else {
                    setRangeTo(day.dateString);
                    if (rangeFrom && day.dateString < rangeFrom) setRangeFrom(day.dateString);
                    setCalendarModalOpen(false);
                  }
                }}
                theme={{
                  selectedDayBackgroundColor: '#2563eb',
                  selectedDayTextColor: '#ffffff',
                  todayTextColor: '#2563eb',
                  arrowColor: '#2563eb',
                }}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {studentRows.length === 0 || dates.length === 0 ? (
          <GlassCard className="p-8 items-center">
            <Ionicons name="information-circle-outline" size={36} color="#94a3b8" />
            <Text className="mt-3 text-gray-500 font-medium text-center">
              No attendance records are available yet for this class.
            </Text>
          </GlassCard>
        ) : dateFilterMode !== 'all' && filteredDates.length === 0 ? (
          <GlassCard className="p-8 items-center">
            <Ionicons name="calendar-outline" size={36} color="#94a3b8" />
            <Text className="mt-3 text-gray-500 font-medium text-center">
              {dateFilterMode === 'single' ? 'Select a date above.' : 'Select From and To dates above.'}
            </Text>
          </GlassCard>
        ) : (
          <GlassCard className="p-0 overflow-hidden">
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View className="flex-row bg-blue-600">
                  <View className="w-40 px-3 py-4 border-r border-blue-500">
                    <Text className="text-xs font-semibold text-white uppercase">Student</Text>
                  </View>
                  <View className="w-40 px-3 py-4 border-r border-blue-500">
                    <Text className="text-xs font-semibold text-white uppercase">Totals</Text>
                  </View>
                  {(dateFilterMode === 'all' ? dates : filteredDates).map((date) => (
                    <View key={date} className="w-24 px-2 py-4 border-r border-blue-500">
                      <Text className="text-[11px] font-semibold text-white text-center">{date}</Text>
                    </View>
                  ))}
                </View>

                <ScrollView style={{ maxHeight: 480 }}>
                  {(dateFilterMode === 'all' ? studentRows : filteredStudentRows).map((row) => (
                    <View
                      key={row.rollNo}
                      className="flex-row border-b border-gray-100 bg-white/90"
                    >
                      <View className="w-40 px-3 py-3 border-r border-gray-100">
                        <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
                          {row.name}
                        </Text>
                        {row.rollNo ? (
                          <Text className="text-xs text-gray-500" numberOfLines={1}>
                            Roll: {row.rollNo}
                          </Text>
                        ) : null}
                      </View>

                      <View className="w-40 px-3 py-3 border-r border-gray-100 justify-center">
                        <Text className="text-xs text-gray-600">
                          Total: <Text className="font-semibold text-gray-900">{row.totals.totalClasses}</Text>
                        </Text>
                        <Text className="text-xs text-emerald-600">
                          Present: <Text className="font-semibold">{row.totals.presents}</Text>
                        </Text>
                        <Text className="text-xs text-rose-600">
                          Absent: <Text className="font-semibold">{row.totals.absents}</Text>
                        </Text>
                        <Text
                          className={`mt-1 text-xs font-semibold ${
                            row.totals.percent < 75 ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {row.totals.percent}% overall
                        </Text>
                      </View>

                      {(dateFilterMode === 'all' ? dates : filteredDates).map((date) => {
                        const cell = matrix[row.rollNo]?.[date];
                        const total = cell?.total || 0;
                        const present = cell?.present || 0;
                        const absent = Math.max(total - present, 0);
                        const status =
                          total === 0 ? 'no-data' : present === total ? 'full-present' : present === 0 ? 'full-absent' : 'mixed';

                        let bgClass = 'bg-gray-50';
                        let textClass = 'text-gray-700';
                        if (status === 'full-present') {
                          bgClass = 'bg-emerald-50';
                          textClass = 'text-emerald-700';
                        } else if (status === 'full-absent') {
                          bgClass = 'bg-rose-50';
                          textClass = 'text-rose-700';
                        } else if (status === 'mixed') {
                          bgClass = 'bg-amber-50';
                          textClass = 'text-amber-700';
                        }

                        return (
                          <View
                            key={date}
                            className={`w-24 px-2 py-3 border-r border-gray-100 items-center justify-center ${bgClass}`}
                          >
                            {total === 0 ? (
                              <Text className="text-[11px] text-gray-400">-</Text>
                            ) : (
                              <>
                                <Text className={`text-xs font-semibold ${textClass}`}>{present}/{total}</Text>
                                {absent > 0 && (
                                  <Text className="text-[10px] text-gray-500">A: {absent}</Text>
                                )}
                              </>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </ScrollView>
              </View>
            </ScrollView>
          </GlassCard>
        )}
      </ScrollContainer>
    </GradientBackground>
  );
};

export default AttendanceMatrixScreen;


