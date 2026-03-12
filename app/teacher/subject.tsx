import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { BackHandler, Platform, ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { useSelector } from "react-redux";
import { useErrorModal } from "../components/ErrorModal";
import { EmptyState, Header, Loader, Modal } from "../components/ui";
import { Input } from "../components/ui/Input";
import {
  GlassCard,
  GradientBackground,
  PrimaryButton,
  ScrollContainer,
} from "../components/ui/kit";
import {
  createAssignment,
  deleteAssignment,
  updateAssignment,
} from "../firebase/assignmentService";
import { getDocument } from "../firebase/firestoreService";
import { createAssignmentNotifications } from "../firebase/notificationService";
import type { Assignment } from "../hooks/useAssignments";
import { useAssignments } from "../hooks/useAssignments";

const SubjectScreen = () => {
  const { classId, subjectId } = useLocalSearchParams<{
    classId: string;
    subjectId: string;
  }>();
  const router = useRouter();
  const { showError, showSuccess, showConfirm } = useErrorModal();
  const { user } = useSelector((state: any) => state.auth);
  const { assignments, loading, refresh } = useAssignments(subjectId || null);
  const [subject, setSubject] = useState<{
    name?: string;
    code?: string;
    classId?: string;
  } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    assignmentName: "",
    totalMarks: "",
    description: "",
    dueDate: "",
    marksVisible: false,
  });

  useEffect(() => {
    if (subjectId) {
      getDocument("subjects", subjectId).then((data) =>
        setSubject(data || null),
      );
    }
  }, [subjectId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (modalOpen) {
        setModalOpen(false);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [modalOpen]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      assignmentName: "",
      totalMarks: "",
      description: "",
      dueDate: "",
      marksVisible: false,
    });
    setModalOpen(true);
  };

  const openEdit = (a: Assignment) => {
    setEditing(a);
    setForm({
      assignmentName: a.assignmentName,
      totalMarks: String(a.totalMarks),
      description: a.description || "",
      dueDate: a.dueDate || "",
      marksVisible: a.marksVisible,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const name = form.assignmentName.trim();
    const total = parseInt(form.totalMarks, 10);
    if (!name || isNaN(total) || total < 0) {
      showError("Assignment name and total marks (≥ 0) are required.");
      return;
    }
    if (!subjectId) return;
    setSaving(true);
    try {
      const payload = {
        assignmentName: name,
        totalMarks: total,
        description: form.description.trim() || undefined,
        dueDate: form.dueDate.trim() || undefined,
        marksVisible: form.marksVisible,
      };
      if (editing) {
        await updateAssignment(subjectId, editing.id, payload);
        showSuccess("Assignment updated.");
      } else {
        const { id } = await createAssignment(subjectId, payload);
        if (classId && subject?.name) {
          await createAssignmentNotifications({
            classId,
            subjectId,
            assignmentName: name,
          });
        }
        showSuccess("Assignment created. Students notified.");
      }
      setModalOpen(false);
      refresh();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (a: Assignment) => {
    if (!subjectId) return;
    showConfirm({
      title: "Delete Assignment",
      message: `Delete "${a.assignmentName}"? This will also remove all submissions.`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        try {
          await deleteAssignment(subjectId, a.id);
          showSuccess("Assignment deleted.");
          refresh();
        } catch (e) {
          showError(e instanceof Error ? e.message : "Delete failed.");
        }
      },
    });
  };

  const handleToggleMarksVisible = async (a: Assignment) => {
    if (!subjectId) return;
    try {
      await updateAssignment(subjectId, a.id, {
        marksVisible: !a.marksVisible,
      });
      showSuccess(a.marksVisible ? "Marks hidden." : "Marks visible.");
      refresh();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Update failed.");
    }
  };

  if (!subjectId || !classId) {
    return (
      <GradientBackground>
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-neutral-500 text-center">
            Missing class or subject.
          </Text>
          <TouchableOpacity onPress={() => router.back()} className="mt-4">
            <Text className="text-primary-600 font-medium">Back</Text>
          </TouchableOpacity>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground padded={false}>
      <ScrollContainer contentClassName="px-4 sm:px-6 lg:px-6 pt-4 pb-12 gap-4 ">
        <Header
          title={subject?.name || "Subject"}
          subtitle={subject?.code}
          onBack={() => router.back()}
        />

        <View className="flex-row gap-2 mb-1 justify-between">
          <TouchableOpacity
            onPress={() =>
              router.push(
                `/teacher/attendance?classId=${classId}&subjectId=${subjectId}`,
              )
            }
            className="flex-1 rounded-2xl border border-primary-200 bg-primary-50 px-2 py-3 flex-row items-center justify-center gap-2"
          >
            <Ionicons name="calendar-outline" size={20} color="#2563eb" />
            <Text className="text-sm font-semibold text-primary-700">
              Take attendance
            </Text>
          </TouchableOpacity>
          <PrimaryButton
            title="Add assignment"
            onPress={openCreate}
            className="flex-1"
          />
        </View>

        {loading ? (
          <Loader message="Loading assignments…" />
        ) : assignments.length === 0 ? (
          <GlassCard className="p-8">
            <EmptyState
              icon="document-text-outline"
              title="No assignments yet"
              description="Add an assignment to get started."
            />
          </GlassCard>
        ) : (
          assignments.map((a) => (
            <GlassCard key={a.id} className="p-5">
              <View className="flex-row justify-between items-start mb-3">
                <View className="flex-1 min-w-0">
                  <Text className="text-lg font-semibold text-neutral-900">
                    {a.assignmentName}
                  </Text>
                  <Text className="text-neutral-500 text-sm">
                    Total marks: {a.totalMarks}
                  </Text>
                  {a.dueDate ? (
                    <Text className="text-neutral-500 text-sm">
                      Due: {a.dueDate}
                    </Text>
                  ) : null}
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs text-neutral-500">
                    Marks visible
                  </Text>
                  <Switch
                    value={a.marksVisible}
                    onValueChange={() => handleToggleMarksVisible(a)}
                    trackColor={{ false: "#e4e4e7", true: "#93c5fd" }}
                    thumbColor="#2563eb"
                  />
                </View>
              </View>
              {a.description ? (
                <Text
                  className="text-neutral-600 text-sm mb-4"
                  numberOfLines={2}
                >
                  {a.description}
                </Text>
              ) : null}
              <View className="flex-row gap-2 flex-wrap justify-around">
                <TouchableOpacity
                  onPress={() =>
                    router.push(
                      `/teacher/assignment-marks?classId=${classId}&subjectId=${subjectId}&assignmentId=${a.id}&assignmentName=${encodeURIComponent(a.assignmentName)}`,
                    )
                  }
                  className="rounded-xl border border-neutral-200 px-4 py-2.5 bg-white"
                >
                  <Text className="text-neutral-700 text-sm font-semibold">
                    Enter marks
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => openEdit(a)}
                  className="rounded-xl border border-neutral-200 px-4 py-2.5 bg-white"
                >
                  <Text className="text-neutral-700 text-sm font-semibold">
                    Edit
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(a)}
                  className="rounded-xl border border-red-200 px-4 py-2.5 bg-red-50"
                >
                  <Text className="text-red-600 text-sm font-semibold">
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          ))
        )}
      </ScrollContainer>

      <Modal
        visible={modalOpen}
        onRequestClose={() => setModalOpen(false)}
        contentClassName="p-6 flex-1 min-h-0"
        fillHeight
      >
        <View className="flex-1 min-h-0">
        <Text className="text-xl font-bold text-neutral-900 mb-4">
          {editing ? "Edit assignment" : "New assignment"}
        </Text>
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            label="Assignment name *"
            value={form.assignmentName}
            onChangeText={(t) => setForm((f) => ({ ...f, assignmentName: t }))}
            placeholder="e.g. Quiz 1"
          />
          <Input
            label="Total marks *"
            value={form.totalMarks}
            onChangeText={(t) => setForm((f) => ({ ...f, totalMarks: t }))}
            placeholder="10"
            keyboardType="numeric"
          />
          <Input
            label="Description (optional)"
            value={form.description}
            onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
            placeholder="Instructions or notes"
            multiline
          />
          <Input
            label="Due date (optional)"
            value={form.dueDate}
            onChangeText={(t) => setForm((f) => ({ ...f, dueDate: t }))}
            placeholder="YYYY-MM-DD"
          />
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-sm font-medium text-neutral-700">
              Marks visible to students
            </Text>
            <Switch
              value={form.marksVisible}
              onValueChange={(v) => setForm((f) => ({ ...f, marksVisible: v }))}
              trackColor={{ false: "#e4e4e7", true: "#93c5fd" }}
              thumbColor="#2563eb"
            />
          </View>
        </ScrollView>
        <View className="flex-row gap-3 pt-2 border-t border-neutral-100">
          <TouchableOpacity
            onPress={() => setModalOpen(false)}
            className="flex-1 bg-neutral-100 py-3.5 rounded-xl min-h-[44px] justify-center"
            activeOpacity={0.8}
          >
            <Text className="text-center font-semibold text-neutral-700">
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            className="flex-1 bg-primary-600 py-3.5 rounded-xl min-h-[44px] justify-center"
            activeOpacity={0.8}
          >
            <Text className="text-white text-center font-semibold">
              {saving ? "Saving…" : "Save"}
            </Text>
          </TouchableOpacity>
        </View>
        </View>
      </Modal>
    </GradientBackground>
  );
};

export default SubjectScreen;
