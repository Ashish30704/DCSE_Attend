import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useErrorModal } from '../components/ErrorModal';
import { EmptyState, Header, Loader } from '../components/ui';
import { GlassCard, GradientBackground, ScrollContainer } from '../components/ui/kit';
import { getAssignments, getSubmission } from '../firebase/assignmentService';
import { getCurrentSession } from '../firebase/sessionService';
import { queryCollection } from '../firebase/firestoreService';

type Assignment = {
  id: string;
  assignmentName: string;
  totalMarks: number;
  description?: string | null;
  dueDate?: string | null;
  marksVisible: boolean;
};
type Subject = { id: string; name?: string; code?: string; classId?: string };

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

const StudentAssignmentsScreen = () => {
  const router = useRouter();
  const { showError } = useErrorModal();
  const { user } = useSelector((state: any) => state.auth);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [data, setData] = useState<{ subject: Subject; assignments: Assignment[] }[]>([]);
  const [myMarks, setMyMarks] = useState<Record<string, { marksObtained?: number }>>({});

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        let students = await queryCollection('students', where('uid', '==', user.uid));
        if (students.length === 0 && (user as any).rollNo) {
          students = await queryCollection('students', where('rollNo', '==', String((user as any).rollNo).trim()));
        }
        const student = students[0];
        if (!student?.classId) {
          setSubjects([]);
          setData([]);
          setLoading(false);
          return;
        }
        const session = await getCurrentSession();
        const subjectsList = await queryCollection(
          'subjects',
          where('classId', '==', student.classId)
        ) as Subject[];
        setSubjects(subjectsList);
        // Submission doc id must be auth uid for Firestore rule: request.auth.uid == submissionId
        const submissionDocId = user.uid;
        const bySubject: { subject: Subject; assignments: Assignment[] }[] = [];
        const marksMap: Record<string, { marksObtained?: number }> = {};
        for (const subj of subjectsList) {
          const assignments = await getAssignments(subj.id);
          bySubject.push({ subject: subj, assignments });
          for (const a of assignments) {
            if (a.marksVisible) {
              const sub = await getSubmission(subj.id, a.id, submissionDocId);
              if (sub) marksMap[`${subj.id}_${a.id}`] = { marksObtained: sub.marksObtained };
            }
          }
        }
        setData(bySubject);
        setMyMarks(marksMap);
      } catch (e) {
        showError(e instanceof Error ? e.message : 'Failed to load assignments.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid]);

  return (
    <GradientBackground padded={false}>
      <ScrollContainer contentClassName="px-4 sm:px-6 lg:px-8 pt-4 pb-12 gap-6">
        <Header title="Assignments" subtitle="View by subject" onBack={() => router.back()} />

        {loading ? (
          <Loader message="Loading assignments…" />
        ) : data.length === 0 ? (
          <GlassCard className="p-8">
            <EmptyState
              icon="document-text-outline"
              title="No assignments"
              description="You don't have any subjects or assignments yet. Check back later."
            />
          </GlassCard>
        ) : (
          data.map(({ subject, assignments }) => (
            <View key={subject.id} className="gap-4">
              <View className="flex-row items-center gap-3 mb-1">
                <View className="w-10 h-10 rounded-xl bg-primary-100 items-center justify-center">
                  <Ionicons name="book-outline" size={22} color="#2563eb" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-lg font-bold text-neutral-900" numberOfLines={1}>
                    {subject.name || 'Subject'}
                  </Text>
                  {subject.code ? (
                    <Text className="text-sm text-neutral-500">Code: {subject.code}</Text>
                  ) : null}
                </View>
              </View>

              {assignments.length === 0 ? (
                <View className="bg-neutral-50 rounded-xl px-4 py-5 border border-neutral-100">
                  <Text className="text-neutral-500 text-sm text-center">No assignments in this subject</Text>
                </View>
              ) : (
                <View className="gap-3">
                  {assignments.map((a) => {
                    const key = `${subject.id}_${a.id}`;
                    const marks = a.marksVisible ? myMarks[key] : null;
                    const hasMarks = a.marksVisible && marks != null && marks.marksObtained != null;
                    return (
                      <GlassCard key={a.id} className="p-5 overflow-hidden">
                        <View className="flex-row items-start gap-3">
                          <View className="w-9 h-9 rounded-lg bg-amber-50 items-center justify-center shrink-0">
                            <Ionicons name="document-text-outline" size={18} color="#d97706" />
                          </View>
                          <View className="flex-1 min-w-0">
                            <Text className="font-semibold text-neutral-900 text-base" numberOfLines={2}>
                              {a.assignmentName}
                            </Text>
                            <View className="flex-row flex-wrap gap-x-4 gap-y-1 mt-2">
                              <Text className="text-neutral-500 text-sm">
                                Total: {a.totalMarks} marks
                              </Text>
                              {a.dueDate ? (
                                <Text className="text-neutral-500 text-sm">
                                  Due: {formatDate(a.dueDate)}
                                </Text>
                              ) : null}
                            </View>
                            {a.description ? (
                              <Text
                                className="text-neutral-600 text-sm mt-2 leading-5"
                                numberOfLines={3}
                              >
                                {a.description}
                              </Text>
                            ) : null}
                            {hasMarks ? (
                              <View className="mt-4 pt-4 border-t border-neutral-100 flex-row items-center gap-2">
                                <View className="w-8 h-8 rounded-full bg-emerald-100 items-center justify-center">
                                  <Ionicons name="checkmark-circle" size={18} color="#059669" />
                                </View>
                                <Text className="text-sm font-semibold text-neutral-800">
                                  Your marks: {marks?.marksObtained} / {a.totalMarks}
                                </Text>
                              </View>
                            ) : a.marksVisible ? (
                              <Text className="text-neutral-400 text-sm mt-3">Marks not yet published</Text>
                            ) : null}
                          </View>
                        </View>
                      </GlassCard>
                    );
                  })}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollContainer>
    </GradientBackground>
  );
};

export default StudentAssignmentsScreen;
