import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { getCurrentSession } from '../firebase/sessionService';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as XLSX from 'xlsx';
import { useErrorModal } from '../components/ErrorModal';
import { GlassCard, GradientBackground, PillTag, ScrollContainer } from '../components/ui/kit';
import { addDocument, getDocument, queryCollection } from '../firebase/firestoreService';
import { exportToExcel } from '../utils/excelService';

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
};

type SubjectDoc = {
  name?: string;
  code?: string;
};

type AttendanceDoc = {
  id?: string;
  classId?: string;
  subjectId?: string;
  date?: string;
  presentStudents?: string[];
  absentStudents?: string[];
  students?: Record<string, boolean>; // Legacy support
};


const AttendanceExportScreen = () => {
  const { classId, subjectId } = useLocalSearchParams<{ classId?: string; subjectId?: string }>();
  const router = useRouter();
  const { user } = useSelector((state: RootState) => state.auth);
  const { showError, showSuccess } = useErrorModal();
  const insets = useSafeAreaInsets();

  const [classData, setClassData] = useState<ClassDoc | null>(null);
  const [subjectData, setSubjectData] = useState<SubjectDoc | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showFormatWarning, setShowFormatWarning] = useState(false);

  // Generate month string from selected year and month
  const month = useMemo(() => {
    return `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  }, [selectedYear, selectedMonth]);

  // Generate years list (current year ± 5 years)
  const years = useMemo(() => {
    const currentYear = now.getFullYear();
    return Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
  }, []);

  // Month names
  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  useEffect(() => {
    const load = async () => {
      if (!classId || !subjectId || !user?.uid) {
        showError('Missing class or subject details', { title: 'Error' });
        router.back();
        return;
      }
      try {
        const cls = (await getDocument('classes', classId)) as ClassDoc | null;
        const subj = (await getDocument('subjects', subjectId)) as SubjectDoc | null;
        setClassData(cls);
        setSubjectData(subj);
        
        // Load students from Firebase students collection by classId
        const currentSession = await getCurrentSession();
        const studentsFromFirebase = await queryCollection(
          'students',
          where('classId', '==', classId),
          where('sessionId', '==', currentSession?.id)
        ) as Student[];
        setStudents(studentsFromFirebase);
      } catch (error) {
        showError('Failed to load class/subject data', { title: 'Error' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [classId, subjectId, user?.uid]);

  const monthLabel = useMemo(() => {
    if (!month || month.length !== 7) return '';
    const [y, m] = month.split('-').map((v) => parseInt(v, 10));
    if (!y || !m) return '';
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
    });
  }, [month]);

  const parseMonthRange = () => {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new Error('Please enter month in YYYY-MM format');
    }
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    if (isNaN(year) || isNaN(m) || m < 1 || m > 12) {
      throw new Error('Invalid month value');
    }
    const startDate = `${yearStr}-${monthStr}-01`;
    const lastDay = new Date(year, m, 0).getDate();
    const endDate = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
    return { startDate, endDate };
  };

  const handleExport = async () => {
    if (!classId || !subjectId) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // ignore haptics errors
    }
    setExporting(true);
    try {
      const { startDate, endDate } = parseMonthRange();
      const attendanceList = (await queryCollection(
        'attendance',
        where('classId', '==', classId),
        where('subjectId', '==', subjectId),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      )) as AttendanceDoc[];

      if (!attendanceList.length) {
        throw new Error('No attendance records found for this month');
      }

      const getRollNo = (s: Student) => String(s?.rollNo ?? s?.rollNumber ?? '').trim();

      // Create a map of dates to attendance records
      const dateMap = new Map<string, AttendanceDoc>();
      attendanceList.forEach(record => {
        if (record.date) {
          dateMap.set(record.date, record);
        }
      });

      // Get all unique dates sorted
      const dates = Array.from(dateMap.keys()).sort();

      // Create rows: one per student, with columns for each date
      const rows: any[] = [];
      
      students.forEach((student) => {
        const rollNo = getRollNo(student);
        const row: any = {
          'Roll Number': rollNo,
          'Name': student.name || '',
        };

        dates.forEach((date) => {
          const record = dateMap.get(date);
          if (record?.presentStudents || record?.absentStudents) {
            const isPresent = record.presentStudents?.includes(rollNo) ?? false;
            const isAbsent = record.absentStudents?.includes(rollNo) ?? false;
            row[date] = isPresent ? 'P' : isAbsent ? 'A' : '-';
          } else {
            row[date] = '-';
          }
        });

        rows.push(row);
      });

      if (!rows.length) {
        throw new Error('No attendance entries found for this month');
      }

      const safeClass = (classData?.name || 'class').replace(/[^\w\-]+/g, '_');
      const safeSubject = (subjectData?.name || 'subject').replace(/[^\w\-]+/g, '_');
      const filename = `attendance_${safeClass}_${safeSubject}_${month}.xlsx`;

      await exportToExcel(rows, filename);
      showSuccess('Attendance exported successfully');
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // ignore
      }
    } catch (error: any) {
      console.error('Attendance export error:', error);
      showError(error.message || 'Failed to export attendance', { title: 'Export Error' });
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {
        // ignore
      }
    } finally {
      setExporting(false);
    }
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
    <View className="flex-1 bg-gray-50">
      <View
        className="bg-white px-4 pb-4 border-b border-gray-200 shadow-sm"
        style={{ paddingTop: insets.top }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-3"
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#2563eb" />
            </TouchableOpacity>
            <View>
              <Text className="text-xs font-semibold text-blue-500">Attendance</Text>
              <Text className="text-xl font-bold text-gray-900">Export & Import</Text>
            </View>
          </View>
          {monthLabel ? (
            <PillTag text={monthLabel} />
          ) : null}
        </View>
      </View>

      {/* Format Warning Modal */}
      <Modal
        visible={showFormatWarning}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFormatWarning(false)}
      >
        <View className="flex-1 bg-black/50 justify-center px-4">
          <View className="bg-white rounded-2xl p-6 max-h-[90%]">
            <View className="flex-row items-center justify-between mb-4">
              <View className="w-12 h-12 bg-yellow-100 rounded-full items-center justify-center">
                <Ionicons name="warning" size={24} color="#F59E0B" />
              </View>
              <TouchableOpacity
                onPress={() => setShowFormatWarning(false)}
                className="p-2"
              >
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text className="text-2xl font-bold text-gray-900 mb-2">Export Format</Text>
            <Text className="text-gray-600 mb-6">
              The exported Excel file will have the following format:
            </Text>

            <ScrollView className="max-h-96">
              <View className="bg-gray-50 rounded-xl p-4 mb-4">
                <Text className="text-sm font-mono text-gray-800 mb-2">
                  Column Headers:
                </Text>
                <View className="bg-white rounded-lg p-3 border border-gray-200">
                  <Text className="text-xs font-mono text-gray-700">
                    Roll Number | Student ID | Name | [Date columns...]
                  </Text>
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-900 mb-2">
                  Format Details:
                </Text>
                <View className="space-y-2">
                  <View className="flex-row items-center">
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text className="text-sm text-gray-700 ml-2">
                      <Text className="font-bold">Roll Number</Text> - Student roll number
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text className="text-sm text-gray-700 ml-2">
                      <Text className="font-bold">Student ID</Text> - Unique student identifier
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text className="text-sm text-gray-700 ml-2">
                      <Text className="font-bold">Name</Text> - Student full name
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text className="text-sm text-gray-700 ml-2">
                      <Text className="font-bold">Date Columns</Text> - Each date shows P (Present) or A (Absent)
                    </Text>
                  </View>
                </View>
              </View>

              <View className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-lg mb-4">
                <Text className="text-sm font-semibold text-blue-900 mb-1">
                  Export Information:
                </Text>
                <Text className="text-xs text-blue-800">
                  • Export includes attendance for the selected month only
                </Text>
                <Text className="text-xs text-blue-800">
                  • Dates are formatted as YYYY-MM-DD column headers
                </Text>
                <Text className="text-xs text-blue-800">
                  • Empty cells indicate no attendance record for that date
                </Text>
                <Text className="text-xs text-blue-800">
                  • File format: .xlsx (Excel)
                </Text>
              </View>

              <View className="bg-gray-50 rounded-xl p-4">
                <Text className="text-sm font-semibold text-gray-900 mb-2">
                  Example:
                </Text>
                <View className="bg-white rounded-lg p-3 border border-gray-200">
                  <Text className="text-xs font-mono text-gray-700">
                    Roll Number | Student ID | Name | 2025-01-03 | 2025-01-04{'\n'}
                    001 | STU001 | John Doe | P | A{'\n'}
                    002 | STU002 | Jane Smith | P | P
                  </Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setShowFormatWarning(false)}
              className="bg-blue-600 rounded-xl py-4 items-center mt-6"
              activeOpacity={0.8}
            >
              <Text className="text-white font-bold text-base">I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <GradientBackground padded={false}>
        <ScrollContainer contentClassName="px-4 sm:px-6 pt-6 pb-10 gap-5">
          <GlassCard className="p-5">
            <Text className="text-xs font-semibold text-blue-500 uppercase tracking-[0.3em] mb-2">
              Attendance
            </Text>
            <Text className="text-2xl font-bold text-gray-900 mb-1">
              {subjectData?.name || 'Subject'} attendance
            </Text>
            <Text className="text-gray-600 mb-3">
              {classData?.name} • {classData?.section} — {students.length} students
            </Text>
            <View className="mt-3">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Select Month & Year
              </Text>
              <View className="flex-row gap-3">
                {/* Month Dropdown */}
                <View className="flex-1">
                  <TouchableOpacity
                    onPress={() => setShowMonthPicker(true)}
                    className="bg-gray-50 px-4 py-3 rounded-2xl border border-gray-200 flex-row items-center justify-between"
                  >
                    <Text className="text-gray-900 font-medium">
                      {months.find(m => m.value === selectedMonth)?.label || 'Select Month'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                {/* Year Dropdown */}
                <View className="flex-1">
                  <TouchableOpacity
                    onPress={() => setShowYearPicker(true)}
                    className="bg-gray-50 px-4 py-3 rounded-2xl border border-gray-200 flex-row items-center justify-between"
                  >
                    <Text className="text-gray-900 font-medium">
                      {selectedYear}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </GlassCard>


          <GlassCard className="p-5 gap-4">
            <Text className="text-sm font-semibold text-gray-800 mb-1">
              Export month-wise attendance
            </Text>
            <Text className="text-xs text-gray-500 mb-2">
              Generates a flat Excel file with one row per student per day, so you can
              filter, analyse or share attendance records easily.
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowFormatWarning(true)}
                className="flex-1 bg-gray-600 rounded-2xl px-4 py-3 flex-row items-center justify-center"
                activeOpacity={0.85}
              >
                <Ionicons name="information-circle-outline" size={18} color="#fff" />
                <Text className="text-white font-semibold text-sm ml-2">Format Info</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleExport}
                disabled={exporting}
                className="flex-1 bg-blue-600 rounded-2xl px-5 py-3 flex-row items-center justify-center"
                activeOpacity={0.85}
              >
                {exporting ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text className="text-white font-bold text-sm ml-2">
                      Generating...
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="download-outline" size={18} color="#fff" />
                    <Text className="text-white font-bold text-sm ml-2">
                      Export Excel
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </GlassCard>

        </ScrollContainer>
      </GradientBackground>

      {/* Month Picker Modal */}
      <Modal
        visible={showMonthPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[70%]">
            <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
              <Text className="text-xl font-bold text-gray-900">Select Month</Text>
              <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView className="max-h-96">
              {months.map((monthOption) => (
                <TouchableOpacity
                  key={monthOption.value}
                  onPress={() => {
                    setSelectedMonth(monthOption.value);
                    setShowMonthPicker(false);
                  }}
                  className={`px-6 py-4 border-b border-gray-100 ${
                    selectedMonth === monthOption.value ? 'bg-blue-50' : 'bg-white'
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text
                      className={`text-base ${
                        selectedMonth === monthOption.value
                          ? 'font-semibold text-blue-700'
                          : 'text-gray-900'
                      }`}
                    >
                      {monthOption.label}
                    </Text>
                    {selectedMonth === monthOption.value && (
                      <Ionicons name="checkmark" size={20} color="#2563eb" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Year Picker Modal */}
      <Modal
        visible={showYearPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowYearPicker(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[70%]">
            <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
              <Text className="text-xl font-bold text-gray-900">Select Year</Text>
              <TouchableOpacity onPress={() => setShowYearPicker(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView className="max-h-96">
              {years.map((year) => (
                <TouchableOpacity
                  key={year}
                  onPress={() => {
                    setSelectedYear(year);
                    setShowYearPicker(false);
                  }}
                  className={`px-6 py-4 border-b border-gray-100 ${
                    selectedYear === year ? 'bg-blue-50' : 'bg-white'
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text
                      className={`text-base ${
                        selectedYear === year
                          ? 'font-semibold text-blue-700'
                          : 'text-gray-900'
                      }`}
                    >
                      {year}
                    </Text>
                    {selectedYear === year && (
                      <Ionicons name="checkmark" size={20} color="#2563eb" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AttendanceExportScreen;


