import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { DepartmentLogo } from "../components/DepartmentLogo";
import { useErrorModal } from "../components/ErrorModal";
import { EmptyState, Loader } from "../components/ui";
import {
  GlassCard,
  GradientBackground,
  PillTag,
  ScrollContainer,
  StatCard,
} from "../components/ui/kit";
import { logoutUser } from "../firebase/authService";
import { getDocument, queryCollection } from "../firebase/firestoreService";
import { getCurrentSession } from "../firebase/sessionService";
import { clearUser } from "../redux/slices/authSlice";

// Component to display student count from Firebase
const ClassStudentCount = ({ classId }: { classId: string }) => {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCount = async () => {
      try {
        const currentSession = await getCurrentSession();
        const studentsList = await queryCollection(
          "students",
          where("classId", "==", classId),
          where("sessionId", "==", currentSession?.id),
        );
        setCount(studentsList.length);
      } catch (error) {
        console.error("Error loading student count:", error);
      } finally {
        setLoading(false);
      }
    };
    if (classId) {
      loadCount();
    }
  }, [classId]);

  if (loading) return <Text className="text-neutral-500 mt-1 text-sm">…</Text>;
  return (
    <Text className="text-neutral-500 mt-1 text-sm">{count} students</Text>
  );
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
    if (!loading && role !== "teacher") {
      router.replace("/");
    }
  }, [role, loading, router]);

  useEffect(() => {
    // Guard: Only load data if user is authenticated and is teacher
    if (user?.uid && role === "teacher") {
      loadClasses();
    } else {
      setLoading(false);
    }
  }, [user?.uid, role]);

  const loadClasses = async () => {
    // Double guard: Prevent queries without user.uid and ensure teacher role
    if (!user?.uid || role !== "teacher") {
      setLoading(false);
      return;
    }
    try {
      const teachers = await queryCollection(
        "teachers",
        where("uid", "==", user?.uid),
      );
      const teacherDocId = teachers.length > 0 ? teachers[0].id : null;
      const teacherUid = user?.uid;

      const classQueryPromises = [];
      if (teacherDocId) {
        classQueryPromises.push(
          queryCollection(
            "classes",
            where("inchargeTeacherId", "==", teacherDocId),
          ),
        );
        classQueryPromises.push(
          queryCollection("classes", where("teacherId", "==", teacherDocId)),
        );
      }
      if (teacherUid) {
        classQueryPromises.push(
          queryCollection(
            "classes",
            where("inchargeTeacherUid", "==", teacherUid),
          ),
        );
        classQueryPromises.push(
          queryCollection("classes", where("teacherId", "==", teacherUid)),
        );
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
        subjectQueryPromises.push(
          queryCollection(
            "subjects",
            where("subjectTeacherId", "==", teacherDocId),
          ),
        );
        subjectQueryPromises.push(
          queryCollection("subjects", where("teacherId", "==", teacherDocId)),
        );
      }
      if (teacherUid) {
        subjectQueryPromises.push(
          queryCollection(
            "subjects",
            where("subjectTeacherUid", "==", teacherUid),
          ),
        );
        subjectQueryPromises.push(
          queryCollection("subjects", where("teacherId", "==", teacherUid)),
        );
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
        new Set(
          subjectsForTeacher.map((subject) => subject.classId).filter(Boolean),
        ),
      );

      const classesFromSubjects = await Promise.all(
        classIdsFromSubjects
          .filter((classId) => !classesMap.has(classId))
          .map(async (classId) => {
            const classData = await getDocument("classes", classId);
            return classData ? { id: classId, ...classData } : null;
          }),
      );

      classesFromSubjects.filter(Boolean).forEach((cls) => {
        classesMap.set(cls.id, cls);
      });

      const classesWithSubjects = Array.from(classesMap.values()).map(
        (classItem) => {
          const filteredSubjects = subjectsForTeacher.filter(
            (subject) => subject.classId === classItem.id,
          );
          const isIncharge =
            (teacherDocId && classItem.inchargeTeacherId === teacherDocId) ||
            (teacherUid && classItem.inchargeTeacherUid === teacherUid) ||
            (teacherDocId &&
              !classItem.inchargeTeacherId &&
              classItem.teacherId === teacherDocId) ||
            (teacherUid &&
              !classItem.inchargeTeacherUid &&
              classItem.teacherId === teacherUid);

          return {
            ...classItem,
            subjects: filteredSubjects,
            assignmentType: isIncharge ? "incharge" : "subject",
          };
        },
      );

      setClasses(classesWithSubjects);
    } catch (error) {
      console.error("Error loading classes:", error);
      showError("Failed to load classes");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    showConfirm({
      title: "Logout",
      message: "Are you sure you want to logout?",
      confirmLabel: "Logout",
      onConfirm: async () => {
        await logoutUser();
        dispatch(clearUser());
        router.replace("/");
      },
    });
  };

  if (loading) {
    return (
      <GradientBackground>
        <Loader message="Loading your classes…" />
      </GradientBackground>
    );
  }

  const totalSubjects = classes.reduce((s, c) => s + (c.subjects?.length || 0), 0);

  return (
    <GradientBackground padded={false}>
      <ScrollContainer contentClassName="px-4 sm:px-6 lg:px-8 pt-4 pb-12 gap-6 max-w-wide w-full mx-auto">
        <View className="mb-4">
          <View className="flex-row items-center justify-between gap-3">
            <DepartmentLogo size={64} />
            <View className="flex-1 min-w-0">
              <Text className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-0.5">
                Welcome back
              </Text>
              <Text className="text-xl font-bold text-neutral-900" numberOfLines={1}>
                {user?.name || "Teacher"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleLogout}
              className="rounded-xl border border-neutral-200 px-4 py-2.5 bg-white flex-row items-center gap-2 shrink-0"
            >
              <Ionicons name="log-out-outline" size={18} color="#52525b" />
              <Text className="text-sm font-semibold text-neutral-700">Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Personal info: compact block */}
        <GlassCard className="p-4">
          <View className="flex-row">
          <View className="flex-1">
              <Text className="text-xs text-neutral-500 mb-0.5">Department</Text>
              <Text className="text-sm font-semibold text-neutral-900" numberOfLines={1}>{(user as any)?.department || 'DCSE'}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-xs text-neutral-500 mb-0.5">Role</Text>
              <Text className="text-sm font-semibold text-neutral-900">Teacher</Text>
            </View>
          </View>
          <View className="flex-row mt-3 pt-3 border-t border-neutral-100">
            
            <View className="flex-1 pr-3">
              <Text className="text-xs text-neutral-500 mb-0.5">Email</Text>
              <Text className="text-sm font-semibold text-neutral-900" numberOfLines={1}>{user?.email || '—'}</Text>
            </View>
          </View>
        </GlassCard>

        {/* Non-personal: StatCards */}
        <View className="flex-row flex-wrap gap-3">
          <StatCard
            label="Classes"
            value={classes.length}
            icon={<Ionicons name="school-outline" size={20} color="#2563eb" />}
            accent="bg-primary-50"
          />
          <StatCard
            label="Subjects"
            value={totalSubjects}
            icon={<Ionicons name="book-outline" size={20} color="#059669" />}
            accent="bg-emerald-50"
          />
        </View>

        {classes.length === 0 ? (
          <GlassCard className="p-8">
            <EmptyState
              icon="school-outline"
              title="No classes assigned"
              description="You don't have any classes or subjects assigned yet."
            />
          </GlassCard>
        ) : (
          classes.map((classItem) => (
            <GlassCard key={classItem.id} className="p-5">
              <View className="flex-row items-start justify-between mb-4">
                <View className="flex-1 min-w-0">
                  <Text className="text-lg font-bold text-neutral-900">
                    {classItem.name}
                  </Text>
                  <ClassStudentCount classId={classItem.id} />
                </View>
                <PillTag
                  text={
                    classItem.assignmentType === "incharge"
                      ? "Incharge"
                      : "Subject"
                  }
                  variant="outline"
                />
              </View>

              {classItem.assignmentType === "incharge" && (
                <TouchableOpacity
                  onPress={() =>
                    router.push(
                      `/teacher/attendance-matrix?classId=${classItem.id}`,
                    )
                  }
                  className="mb-4 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 flex-row items-center justify-between"
                  activeOpacity={0.8}
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="grid-outline" size={18} color="#2563eb" />
                    <Text className="text-sm font-semibold text-primary-700">
                      Attendance matrix
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#2563eb" />
                </TouchableOpacity>
              )}

              {classItem.subjects && classItem.subjects.length > 0 ? (
                <View className="gap-2">
                  {classItem.subjects.map((subject) => (
                    <TouchableOpacity
                      key={subject.id}
                      onPress={() =>
                        router.push(
                          `/teacher/subject?classId=${classItem.id}&subjectId=${subject.id}`,
                        )
                      }
                      className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 flex-row items-center justify-between"
                      activeOpacity={0.8}
                    >
                      <View className="flex-1 min-w-0">
                        <Text className="text-base font-semibold text-neutral-900">
                          {subject.name}
                        </Text>
                        <Text className="text-xs text-neutral-500 mt-0.5">
                          Code: {subject.code || "—"}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color="#a1a1aa"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text className="text-neutral-500 text-sm">
                  No subjects assigned
                </Text>
              )}
            </GlassCard>
          ))
        )}
      </ScrollContainer>
    </GradientBackground>
  );
};

export default TeacherDashboard;
