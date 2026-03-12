import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useErrorModal } from '../components/ErrorModal';
import { EmptyState, Header, Loader } from '../components/ui';
import { GlassCard, GradientBackground, PrimaryButton, ScrollContainer } from '../components/ui/kit';
import { getSubmissions, setSubmission, updateAssignment } from '../firebase/assignmentService';
import { getCurrentSession } from '../firebase/sessionService';
import { queryCollection } from '../firebase/firestoreService';

type Student = { id: string; uid?: string; name?: string; rollNo?: string; rollNumber?: string };

const AssignmentMarksScreen = () => {
  const { classId, subjectId, assignmentId, assignmentName } = useLocalSearchParams<{
    classId: string;
    subjectId: string;
    assignmentId: string;
    assignmentName?: string;
  }>();
  const router = useRouter();
  const { showError, showSuccess } = useErrorModal();
  const { user } = useSelector((state: any) => state.auth);
  const [students, setStudents] = useState<Student[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, { marksObtained?: number }>>({});
  const [marksInput, setMarksInput] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!classId || !subjectId || !assignmentId) return;
    (async () => {
      setLoading(true);
      try {
        const session = await getCurrentSession();
        const list = await queryCollection(
          'students',
          where('classId', '==', classId),
          where('sessionId', '==', session?.id)
        ) as Student[];
        setStudents(list);
        const subs = await getSubmissions(subjectId, assignmentId);
        const byId: Record<string, { marksObtained?: number }> = {};
        // Key marks by student.uid (so student can read their doc) or student.id for display
        const nextMarks: Record<string, string> = {};
        list.forEach((student) => {
          const key = student.uid || student.id;
          const sub = subs.find((s) => s.id === student.uid || s.id === student.id);
          if (sub) {
            byId[key] = { marksObtained: sub.marksObtained };
            nextMarks[key] = String(sub.marksObtained ?? '');
          }
        });
        setSubmissions(byId);
        setMarksInput((prev) => ({ ...prev, ...nextMarks }));
      } catch (e) {
        showError(e instanceof Error ? e.message : 'Failed to load.');
      } finally {
        setLoading(false);
      }
    })();
  }, [classId, subjectId, assignmentId]);

  const handleSave = async () => {
    if (!subjectId || !assignmentId || !user?.uid) return;
    setSaving(true);
    try {
      // Use only student.uid so students can read their submission (Firestore rule: submissionId == auth.uid)
      let saved = 0;
      for (const student of students) {
        const uid = student.uid;
        if (!uid) continue; // Skip students without uid; they wouldn't see marks anyway
        const raw = marksInput[uid]?.trim();
        const num = raw === '' ? undefined : parseFloat(raw);
        if (num === undefined || isNaN(num)) continue;
        await setSubmission(subjectId, assignmentId, uid, {
          marksObtained: num,
          evaluatedBy: user.uid,
        });
        saved++;
      }
      // Make marks visible to students when teacher saves
      await updateAssignment(subjectId, assignmentId, { marksVisible: true });
      showSuccess(saved > 0 ? 'Marks saved and published.' : 'No marks to save.');
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  if (!classId || !subjectId || !assignmentId) {
    return (
      <GradientBackground>
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-neutral-500 text-center">Missing params.</Text>
          <TouchableOpacity onPress={() => router.back()} className="mt-4">
            <Text className="text-primary-600 font-medium">Back</Text>
          </TouchableOpacity>
        </View>
      </GradientBackground>
    );
  }

  const decodedName = assignmentName ? decodeURIComponent(assignmentName) : 'Assignment';

  return (
    <GradientBackground padded={false}>
      <ScrollContainer contentClassName="px-4 sm:px-6 lg:px-8 pt-4 pb-12 gap-5 max-w-wide mx-auto">
        <Header title="Enter marks" subtitle={decodedName} onBack={() => router.back()} />

        {loading ? (
          <Loader message="Loading students…" />
        ) : students.length === 0 ? (
          <GlassCard className="p-8">
            <EmptyState icon="people-outline" title="No students" description="No students in this class." />
          </GlassCard>
        ) : (
          <>
            {students.map((s) => {
              const key = s.uid || s.id;
              const rollNo = s.rollNo ?? s.rollNumber ?? '';
              const canReceiveMarks = !!s.uid;
              return (
                <GlassCard key={s.id} className="p-5 flex-row items-center justify-between gap-3">
                  <View className="flex-1 min-w-0">
                    <Text className="font-semibold text-neutral-900">{s.name}</Text>
                    <Text className="text-neutral-500 text-sm">
                      Roll: {rollNo}
                      {!canReceiveMarks && ' • Account not linked (marks will not appear for student)'}
                    </Text>
                  </View>
                  <View className="w-24">
                    <TextInput
                      value={marksInput[key] ?? ''}
                      onChangeText={(t) => setMarksInput((prev) => ({ ...prev, [key]: t }))}
                      placeholder="Marks"
                      keyboardType="decimal-pad"
                      className="border border-neutral-200 rounded-xl bg-neutral-50 px-3 py-2.5 text-center text-neutral-900"
                      placeholderTextColor="#a1a1aa"
                    />
                  </View>
                </GlassCard>
              );
            })}
            <PrimaryButton title="Save marks" onPress={handleSave} loading={saving} />
          </>
        )}
      </ScrollContainer>
    </GradientBackground>
  );
};

export default AssignmentMarksScreen;
