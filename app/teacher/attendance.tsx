import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useErrorModal } from '../components/ErrorModal';
import { GlassCard, GradientBackground, PillTag, PrimaryButton, ScrollContainer } from '../components/ui/kit';
import { addDocument, getDocument, queryCollection } from '../firebase/firestoreService';

type Student = {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
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
  name?: string;
  subjectTeacherUid?: string;
  subjectTeacherId?: string;
  teacherId?: string;
};

type AttendanceDoc = {
  id?: string;
  students?: Record<string, boolean>;
};

type RootState = {
  auth: {
    user: {
      uid?: string;
      name?: string;
    } | null;
  };
};

const AttendanceScreen = () => {
  const { classId, subjectId } = useLocalSearchParams();
  const [classData, setClassData] = useState<ClassDoc | null>(null);
  const [subjectData, setSubjectData] = useState<SubjectDoc | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [attendanceLocked, setAttendanceLocked] = useState(false);
  const router = useRouter();
  const { user } = useSelector((state: RootState) => state.auth);
  const { showError, showSuccess } = useErrorModal();

  useEffect(() => {
    if (classId && subjectId && user?.uid) {
      loadData();
    }
  }, [classId, subjectId, date, user?.uid]);

  const loadData = async () => {
    try {
      const teacherDocs = user?.uid
        ? await queryCollection('teachers', where('uid', '==', user.uid))
        : [];
      const teacherDocId = teacherDocs.length > 0 ? teacherDocs[0].id : null;

      const classDataObj = (await getDocument('classes', classId)) as ClassDoc | null;
      const subjectDataObj = (await getDocument('subjects', subjectId)) as SubjectDoc | null;

      const isClassIncharge =
        classDataObj &&
        (classDataObj.inchargeTeacherUid === user?.uid ||
          classDataObj.inchargeTeacherId === teacherDocId ||
          (!classDataObj.inchargeTeacherUid &&
            (classDataObj.teacherId === teacherDocId || classDataObj.teacherId === user?.uid)));

      const isSubjectTeacher =
        subjectDataObj &&
        (subjectDataObj.subjectTeacherUid === user?.uid ||
          subjectDataObj.subjectTeacherId === teacherDocId ||
          (!subjectDataObj.subjectTeacherUid &&
            (subjectDataObj.teacherId === teacherDocId || subjectDataObj.teacherId === user?.uid)));

      if (!isClassIncharge && !isSubjectTeacher) {
        showError('You are not assigned to this class or subject.', { title: 'Access Denied' });
        setLoading(false);
        router.back();
        return;
      }

      setIsAuthorized(true);

      if (classDataObj) {
        setClassData(classDataObj);
      }

      if (subjectDataObj) {
        setSubjectData(subjectDataObj);
      }

      // Load students from Firebase students collection by classId
      const { getCurrentSession } = await import('../firebase/sessionService');
      const currentSession = await getCurrentSession();
      const studentsList = await queryCollection(
        'students',
        where('classId', '==', classId),
        where('sessionId', '==', currentSession?.id)
      ) as Student[];
      setStudents(studentsList);

      // Load existing attendance for this date
      const attendanceList = (await queryCollection(
        'attendance',
        where('classId', '==', classId),
        where('subjectId', '==', subjectId),
        where('date', '==', date)
      )) as any[];

      const getRollNo = (s: Student) => String(s?.rollNo ?? s?.rollNumber ?? s?.id ?? '').trim();
      if (attendanceList.length > 0) {
        const existing = attendanceList[0];
        const attendanceObj: Record<string, boolean> = {};
        const presentRollNos = new Set((existing.presentStudents || []).map(String));
        studentsList.forEach((student) => {
          const rollNo = getRollNo(student);
          if (rollNo) attendanceObj[rollNo] = presentRollNos.has(rollNo);
        });
        setAttendance(attendanceObj);
      } else {
        const initialAttendance: Record<string, boolean> = {};
        studentsList.forEach((student) => {
          const rollNo = getRollNo(student);
          if (rollNo) initialAttendance[rollNo] = false;
        });
        setAttendance(initialAttendance);
      }

      // Lock attendance only after 5:00 PM on the selected day (editable same day before 5 PM)
      const now = new Date();
      const selected = new Date(date + 'T00:00:00');
      const isSameDay = now.toDateString() === selected.toDateString();
      const allowEdit = isSameDay && now.getHours() < 17;
      setAttendanceLocked(!allowEdit);
    } catch (error) {
      showError('Failed to load data', { title: 'Error' });
    } finally {
      setLoading(false);
    }
  };

  const getRollNo = (s: Student) => String(s?.rollNo ?? s?.rollNumber ?? s?.id ?? '').trim();

  const toggleAttendance = (rollNo: string) => {
    setAttendance(prev => ({ ...prev, [rollNo]: !prev[rollNo] }));
  };

  const markAllPresent = () => {
    const allPresent: Record<string, boolean> = {};
    students.forEach((student) => {
      const r = getRollNo(student);
      if (r) allPresent[r] = true;
    });
    setAttendance(allPresent);
  };

  const markAllAbsent = () => {
    const allAbsent: Record<string, boolean> = {};
    students.forEach((student) => {
      const r = getRollNo(student);
      if (r) allAbsent[r] = false;
    });
    setAttendance(allAbsent);
  };

  const handleSave = async () => {
    if (attendanceLocked) return;
    const now = new Date();
    const selected = new Date(date + 'T00:00:00');
    const isSameDay = now.toDateString() === selected.toDateString();
    if (!isSameDay || now.getHours() >= 17) {
      showError('Attendance can only be edited before 5:00 PM on the same day.', { title: 'Editing closed' });
      return;
    }
    setSaving(true);
    try {
      // Get current session
      const { getCurrentSession } = await import('../firebase/sessionService');
      const currentSession = await getCurrentSession();
      
      // Convert attendance object to presentStudents and absentStudents arrays (using roll numbers)
      const presentStudents: string[] = [];
      const absentStudents: string[] = [];
      
      students.forEach((student) => {
        const rollNo = getRollNo(student);
        if (rollNo) {
          if (attendance[rollNo]) {
            presentStudents.push(rollNo);
          } else {
            absentStudents.push(rollNo);
          }
        }
      });

      // Get teacher ID
      const teacherDocs = user?.uid
        ? await queryCollection('teachers', where('uid', '==', user.uid))
        : [];
      const teacherId = teacherDocs.length > 0 ? teacherDocs[0].id : null;

      const attendanceData = {
        classId,
        subjectId,
        teacherId: teacherId || user?.uid,
        date,
        presentStudents,
        absentStudents,
        sessionId: currentSession?.id,
        createdAt: new Date().toISOString(),
      };
      
      const existingAttendance = (await queryCollection(
        'attendance',
        where('classId', '==', classId),
        where('subjectId', '==', subjectId),
        where('date', '==', date)
      )) as AttendanceDoc[];

      const { updateDocument } = await import('../firebase/firestoreService');
      if (existingAttendance.length === 0) {
        await addDocument('attendance', attendanceData);
      } else {
        const existingId = existingAttendance[0].id;
        if (!existingId) {
          showError('Could not update attendance record.', { title: 'Error' });
          setSaving(false);
          return;
        }
        await updateDocument('attendance', existingId, {
          presentStudents,
          absentStudents,
          teacherId: attendanceData.teacherId,
          sessionId: attendanceData.sessionId,
        });
      }

      try {
        const { createAttendanceNotifications } = await import('../firebase/notificationService');
        const className = `${classData?.name || ''} ${classData?.section || ''}`.trim();
        await createAttendanceNotifications({
          classId: String(classId),
          subjectId: String(subjectId),
          subjectName: subjectData?.name || 'Subject',
          className: className || 'Class',
          date,
          presentStudents,
          absentStudents,
          teacherName: user?.name || 'Teacher',
        });
      } catch (notifError) {
        console.warn('Failed to create notifications:', notifError);
      }
      showSuccess('Attendance saved successfully');
    } catch (error) {
      showError('Failed to save attendance', { title: 'Error' });
    } finally {
      setSaving(false);
    }
  };

  const getAttendanceStats = () => {
    const total = students.length;
    const present = Object.values(attendance).filter(Boolean).length;
    const absent = total - present;
    return { total, present, absent };
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

  const stats = getAttendanceStats();

  return (
    <GradientBackground padded={false}>
      <ScrollContainer contentClassName="px-4 sm:px-6 pt-12 pb-10 gap-4">
        <GlassCard className="p-5 flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <TouchableOpacity onPress={() => router.back()} className="mb-2 flex-row items-center gap-2">
              <Ionicons name="chevron-back" size={18} color="#2563eb" />
              <Text className="text-sm font-semibold text-blue-600">Back</Text>
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-gray-900">{subjectData?.name}</Text>
            <Text className="text-gray-500 mt-1">
              {classData?.name}{classData?.section ? ` — ${classData.section}` : ''}
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              <PillTag text={`Date: ${date}`} variant="outline" />
              <PillTag text={`${students.length} students`} />
            </View>
          </View>
          <View className="items-end gap-2">
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              className="bg-gray-50 px-4 py-3 rounded-2xl border border-gray-100 text-gray-900 w-36 text-center"
              placeholderTextColor="#9ca3af"
            />
            {classId && subjectId ? (
              <TouchableOpacity
                onPress={() =>
                  router.push(
                    `/teacher/attendance-export?classId=${encodeURIComponent(
                      String(classId),
                    )}&subjectId=${encodeURIComponent(String(subjectId))}`,
                  )
                }
                className="flex-row items-center gap-1 px-3 py-2 rounded-2xl bg-blue-50 border border-blue-100"
              >
                <Ionicons name="download-outline" size={14} color="#2563eb" />
                <Text className="text-[11px] font-semibold text-blue-700">Excel</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </GlassCard>

        <View className="flex-row gap-4">
          <GlassCard className="flex-1 p-4">
            <Text className="text-gray-500 text-sm mb-1">Total</Text>
            <Text className="text-2xl font-semibold text-gray-900">{stats.total}</Text>
          </GlassCard>
          <GlassCard className="flex-1 p-4 bg-green-50/80 border-green-100">
            <Text className="text-green-600 text-sm mb-1">Present</Text>
            <Text className="text-2xl font-semibold text-green-700">{stats.present}</Text>
          </GlassCard>
          <GlassCard className="flex-1 p-4 bg-rose-50/80 border-rose-100">
            <Text className="text-rose-600 text-sm mb-1">Absent</Text>
            <Text className="text-2xl font-semibold text-rose-700">{stats.absent}</Text>
          </GlassCard>
        </View>

        {!attendanceLocked && (
          <View className="flex-row gap-3 mb-4">
            <TouchableOpacity onPress={markAllPresent} className="flex-1 bg-emerald-500 rounded-2xl py-3 items-center shadow-lg shadow-emerald-200">
              <Text className="text-white font-semibold">Mark All Present</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={markAllAbsent} className="flex-1 bg-rose-500 rounded-2xl py-3 items-center shadow-lg shadow-rose-200">
              <Text className="text-white font-semibold">Mark All Absent</Text>
            </TouchableOpacity>
          </View>
        )}

        {students.length === 0 ? (
          <GlassCard className="p-6">
            <Text className="text-center text-gray-500">No students in this class</Text>
          </GlassCard>
        ) : (
          students.map((student: Student) => {
            const rollNo = getRollNo(student);
            if (!rollNo) return null;
            return (
              <GlassCard
                key={rollNo}
                className={`p-4 mb-2 border-2 ${attendance[rollNo] ? 'border-green-300 bg-green-50/70' : 'border-gray-100'}`}
              >
                {attendanceLocked ? (
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-4">
                      <Text className="text-lg font-semibold text-gray-900">{student.name}</Text>
                      <Text className="text-gray-500 text-sm">Roll: {rollNo}</Text>
                    </View>
                    <View
                      className={`w-8 h-8 rounded-full border-2 items-center justify-center ${attendance[rollNo] ? 'bg-green-500 border-green-500' : 'border-gray-200'}`}
                    >
                      {attendance[rollNo] ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity className="flex-row items-center justify-between" onPress={() => toggleAttendance(rollNo)}>
                    <View className="flex-1 pr-4">
                      <Text className="text-lg font-semibold text-gray-900">{student.name}</Text>
                      <Text className="text-gray-500 text-sm">Roll: {rollNo}</Text>
                    </View>
                    <View
                      className={`w-8 h-8 rounded-full border-2 items-center justify-center ${attendance[rollNo] ? 'bg-green-500 border-green-500' : 'border-gray-200'}`}
                    >
                      {attendance[rollNo] ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                    </View>
                  </TouchableOpacity>
                )}
              </GlassCard>
            );
          })
        )}

        {!attendanceLocked && (
          <PrimaryButton title="Save Attendance" onPress={handleSave} loading={saving} />
        )}
        {attendanceLocked && (
          <Text className="my-4 text-center text-amber-600 font-semibold">Attendance can only be edited before 5:00 PM on the same day. It is now locked for this date.</Text>
        )}
      </ScrollContainer>
    </GradientBackground>
  );
};

export default AttendanceScreen;

