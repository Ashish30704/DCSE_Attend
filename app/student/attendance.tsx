import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { where } from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSelector } from "react-redux";
import {
  GlassCard,
  GradientBackground,
  ScrollContainer,
} from "../components/ui/kit";
import { ScreenSkeleton } from "../components/ui";
import { queryCollection, queryCollectionWithLimit } from "../firebase/firestoreService";
import { getCurrentSession } from "../firebase/sessionService";

type Student = {
  studentId?: string;
  name?: string;
  rollNo?: string;
  rollNumber?: string;
  classId?: string;
};

type AttendanceDoc = {
  id?: string;
  classId?: string;
  subjectId?: string;
  date?: string;
  presentStudents?: string[];
  absentStudents?: string[];
};

type SubjectDoc = {
  id?: string;
  name?: string;
  code?: string;
};

const StudentAttendanceScreen = () => {
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState<Student | null>(null);
  const [subjects, setSubjects] = useState<SubjectDoc[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SubjectDoc | null>(
    null,
  );
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceDoc[]>(
    [],
  );
  const router = useRouter();
  const { user } = useSelector((state: any) => state.auth);

  useEffect(() => {
    loadData();
  }, [user?.uid]);

  useEffect(() => {
    if (selectedSubject && studentData) {
      loadAttendanceForSubject(selectedSubject.id!);
    }
  }, [selectedSubject, studentData]);

  const loadData = async () => {
    try {
      const currentSession = await getCurrentSession();

      let studentsList = (await queryCollection(
        "students",
        where("uid", "==", user?.uid),
      )) as Student[];

      if (studentsList.length === 0 && (user as any)?.rollNo) {
        studentsList = (await queryCollection(
          "students",
          where("rollNo", "==", String((user as any).rollNo).trim()),
        )) as Student[];
      }

      if (studentsList.length === 0) {
        setLoading(false);
        return;
      }

      const student = studentsList[0];
      setStudentData(student);

      // Get subjects for this class
      if (student.classId) {
        const subjectsList = (await queryCollection(
          "subjects",
          where("classId", "==", student.classId),
        )) as SubjectDoc[];
        setSubjects(subjectsList);
        if (subjectsList.length > 0) {
          setSelectedSubject(subjectsList[0]);
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceForSubject = async (subjectId: string) => {
    if (!studentData?.classId) return;

    try {
      const currentSession = await getCurrentSession();
      const rollNo = studentData.rollNo || studentData.rollNumber;

      const attendanceList = (await queryCollectionWithLimit(
        "attendance",
        1000,
        where("classId", "==", studentData.classId),
        where("subjectId", "==", subjectId),
        where("sessionId", "==", currentSession?.id),
      )) as AttendanceDoc[];

      // Filter attendance where student is present or absent
      const studentAttendance = attendanceList.filter((att) => {
        const present = att.presentStudents?.includes(rollNo || "") || false;
        const absent = att.absentStudents?.includes(rollNo || "") || false;
        return present || absent;
      });

      // Sort by date descending
      studentAttendance.sort((a, b) =>
        (b.date || "").localeCompare(a.date || ""),
      );

      setAttendanceRecords(studentAttendance);
    } catch (error) {
      console.error("Error loading attendance:", error);
    }
  };

  const getAttendanceStatus = useCallback(
    (record: AttendanceDoc): "present" | "absent" => {
      const rollNo = studentData?.rollNo || studentData?.rollNumber || "";
      if (record.presentStudents?.includes(rollNo)) {
        return "present";
      }
      return "absent";
    },
    [studentData?.rollNo, studentData?.rollNumber],
  );

  if (loading) {
    return (
      <GradientBackground>
        <ScreenSkeleton rows={6} />
      </GradientBackground>
    );
  }

  return (
    <GradientBackground padded={false}>
      <ScrollContainer contentClassName="px-4 sm:px-6 pt-12 pb-10 gap-4">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <TouchableOpacity
              onPress={() => router.back()}
              className="mb-2 flex-row items-center gap-2"
            >
              <Ionicons name="chevron-back" size={18} color="#2563eb" />
              <Text className="text-sm font-semibold text-blue-600">Back</Text>
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-gray-900">
              My Attendance
            </Text>
            <Text className="text-gray-500 mt-1">
              View your attendance records by subject
            </Text>
          </View>
        </View>

        {/* Subject Selector */}
        {subjects.length > 0 && (
          <GlassCard className="p-4">
            <Text className="text-sm font-semibold text-gray-700 mb-3">
              Select Subject
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="flex-row gap-2"
            >
              {subjects.map((subject) => (
                <TouchableOpacity
                  key={subject.id}
                  onPress={() => setSelectedSubject(subject)}
                  className={`px-4 py-2 rounded-2xl border ${
                    selectedSubject?.id === subject.id
                      ? "bg-blue-600 border-blue-600"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <Text
                    className={`font-semibold ${
                      selectedSubject?.id === subject.id
                        ? "text-white"
                        : "text-gray-700"
                    }`}
                  >
                    {subject.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </GlassCard>
        )}

        {/* Attendance Table */}
        {selectedSubject && (
          <GlassCard className="p-4">
            <Text className="text-lg font-semibold text-gray-900 mb-4">
              {selectedSubject.name} - Attendance Records
            </Text>
            {attendanceRecords.length === 0 ? (
              <Text className="text-center text-gray-500 py-8">
                No attendance records found
              </Text>
            ) : (
              <View className="space-y-2">
                {/* Table Header */}
                <View className="flex-row bg-gray-100 rounded-lg p-3 mb-2">
                  <Text className="flex-1 font-semibold text-gray-700">
                    Date
                  </Text>
                  <Text className="flex-1 font-semibold text-gray-700 text-right">
                    Status
                  </Text>
                </View>
                {/* Table Rows */}
                {attendanceRecords.map((record) => {
                  const status = getAttendanceStatus(record);
                  return (
                    <View
                      key={record.id}
                      className={`my-1 flex-row flex-1 items-center p-3 rounded-lg border ${
                        status === "present"
                          ? "bg-green-50 border-green-200"
                          : "bg-rose-50 border-rose-200"
                      }`}
                    >
                      <Text className="flex-1 text-gray-900 font-medium">
                        {record.date
                          ? new Date(record.date).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "N/A"}
                      </Text>
                      <View className="flex-row items-center gap-2">
                        <View
                          className={`w-3 h-3 rounded-full ${
                            status === "present"
                              ? "bg-green-500"
                              : "bg-rose-500"
                          }`}
                        />
                        <Text
                          className={`font-semibold ${
                            status === "present"
                              ? "text-green-700"
                              : "text-rose-700"
                          }`}
                        >
                          {status === "present" ? "Present" : "Absent"}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </GlassCard>
        )}
      </ScrollContainer>
    </GradientBackground>
  );
};

export default StudentAttendanceScreen;
