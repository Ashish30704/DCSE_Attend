import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { where } from "firebase/firestore";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSelector } from "react-redux";
import { useErrorModal } from "../components/ErrorModal";
import { EmptyState, Header, Loader } from "../components/ui";
import {
  GlassCard,
  GradientBackground,
  PrimaryButton,
} from "../components/ui/kit";
import {
  getSubmissions,
  setSubmission,
  updateAssignment,
} from "../firebase/assignmentService";
import { queryCollection } from "../firebase/firestoreService";
import { getCurrentSession } from "../firebase/sessionService";

type Student = {
  id: string;
  uid?: string;
  name?: string;
  rollNo?: string;
  rollNumber?: string;
};

/** Virtualized row — FlashList recycles views; keep stable handlers via onChangeKey. */
type MarkRowProps = {
  student: Student;
  inputKey: string;
  rollNo: string;
  value: string;
  onChangeKey: (key: string, text: string) => void;
};

const MarkRow = memo(function MarkRow({
  student: s,
  inputKey,
  rollNo,
  value,
  onChangeKey,
}: MarkRowProps) {
  const onChangeText = useCallback(
    (t: string) => {
      onChangeKey(inputKey, t);
    },
    [onChangeKey, inputKey],
  );

  return (
    <GlassCard className="p-5 flex-row items-center justify-between gap-3 mb-3">
      <View className="flex-1 min-w-0">
        <Text className="font-semibold text-neutral-900">{s.name}</Text>
        <Text className="text-neutral-500 text-sm">
          Roll: {rollNo}
          {!s.uid
            ? " • Not linked yet — marks are saved and shown when marks are published"
            : null}
        </Text>
      </View>
      <View className="w-24">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Marks"
          keyboardType="decimal-pad"
          className="border border-neutral-200 rounded-xl bg-neutral-50 px-3 py-2.5 text-center text-neutral-900"
          placeholderTextColor="#a1a1aa"
        />
      </View>
    </GlassCard>
  );
});

const AssignmentMarksScreen = () => {
  const { classId, subjectId, assignmentId, assignmentName } =
    useLocalSearchParams<{
      classId: string;
      subjectId: string;
      assignmentId: string;
      assignmentName?: string;
    }>();
  const router = useRouter();
  const { showError, showSuccess } = useErrorModal();
  const { user } = useSelector((state: any) => state.auth);
  const [students, setStudents] = useState<Student[]>([]);
  const [marksInput, setMarksInput] = useState<Record<string, string>>({});
  const marksRef = useRef(marksInput);
  marksRef.current = marksInput;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!classId || !subjectId || !assignmentId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const session = await getCurrentSession();
        const list = (await queryCollection(
          "students",
          where("classId", "==", classId),
          where("sessionId", "==", session?.id),
        )) as Student[];
        if (cancelled) return;
        setStudents(list);
        const subs = await getSubmissions(subjectId, assignmentId);
        const nextMarks: Record<string, string> = {};
        list.forEach((student) => {
          const key = student.uid || student.id;
          const sub = subs.find(
            (s) => s.id === student.uid || s.id === student.id,
          );
          if (sub) {
            nextMarks[key] = String(sub.marksObtained ?? "");
          }
        });
        setMarksInput((prev) => ({ ...prev, ...nextMarks }));
      } catch (e) {
        if (!cancelled) {
          showError(e instanceof Error ? e.message : "Failed to load.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, subjectId, assignmentId]);

  const onMarksKeyChange = useCallback((key: string, text: string) => {
    setMarksInput((prev) => ({ ...prev, [key]: text }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!subjectId || !assignmentId || !user?.uid) return;
    const snapshot = marksRef.current;
    setSaving(true);
    try {
      let saved = 0;
      for (const student of students) {
        const submissionDocId = student.uid || student.id;
        if (!submissionDocId) continue;
        const raw = snapshot[submissionDocId]?.trim();
        const num = raw === "" ? undefined : parseFloat(raw);
        if (num === undefined || isNaN(num)) continue;
        await setSubmission(subjectId, assignmentId, submissionDocId, {
          marksObtained: num,
          evaluatedBy: user.uid,
        });
        saved++;
      }
      await updateAssignment(subjectId, assignmentId, { marksVisible: true });
      showSuccess(
        saved > 0 ? "Marks saved and published." : "No marks to save.",
      );
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }, [subjectId, assignmentId, user?.uid, students, showSuccess, showError]);

  const decodedName = useMemo(
    () =>
      assignmentName ? decodeURIComponent(assignmentName) : "Assignment",
    [assignmentName],
  );

  const listHeader = useMemo(
    () => (
      <View className="px-2 sm:px-4 lg:px-6 pt-4 pb-2 max-w-wide self-stretch w-full">
        <Header
          title="Enter marks"
          subtitle={decodedName}
          onBack={() => router.back()}
        />
      </View>
    ),
    [decodedName, router],
  );

  const listFooter = useMemo(
    () => (
      <View className="px-2 sm:px-4 lg:px-6 pb-12 pt-2 max-w-wide self-stretch w-full">
        <PrimaryButton
          title="Save marks"
          onPress={handleSave}
          loading={saving}
        />
      </View>
    ),
    [handleSave, saving],
  );

  const renderItem = useCallback(
    ({ item: s }: { item: Student }) => {
      const key = s.uid || s.id;
      const rollNo = s.rollNo ?? s.rollNumber ?? "";
      return (
        <MarkRow
          student={s}
          inputKey={key}
          rollNo={rollNo}
          value={marksInput[key] ?? ""}
          onChangeKey={onMarksKeyChange}
        />
      );
    },
    [marksInput, onMarksKeyChange],
  );

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

  if (loading) {
    return (
      <GradientBackground padded={false}>
        <View className="px-2 sm:px-4 lg:px-6 pt-4 max-w-wide w-full self-center">
          <Header
            title="Enter marks"
            subtitle={decodedName}
            onBack={() => router.back()}
          />
          <Loader message="Loading students…" />
        </View>
      </GradientBackground>
    );
  }

  if (students.length === 0) {
    return (
      <GradientBackground padded={false}>
        <View className="px-2 sm:px-4 lg:px-6 pt-4 max-w-wide w-full self-center">
          <Header
            title="Enter marks"
            subtitle={decodedName}
            onBack={() => router.back()}
          />
          <GlassCard className="p-8 mt-4">
            <EmptyState
              icon="people-outline"
              title="No students"
              description="No students in this class."
            />
          </GlassCard>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground padded={false}>
      <FlashList
        data={students}
        keyExtractor={(s) => s.id}
        estimatedItemSize={96}
        // Re-bind cells when marks map updates (teacher typing).
        extraData={marksInput}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 8 }}
        style={{ flex: 1 }}
      />
    </GradientBackground>
  );
};

export default AssignmentMarksScreen;
