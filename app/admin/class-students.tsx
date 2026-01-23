import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useErrorModal } from '../components/ErrorModal';
import { GlassCard, GradientBackground, PrimaryButton, ScrollContainer } from '../components/ui/kit';
import { addDocument, deleteDocument, getDocument, queryCollection, updateDocument } from '../firebase/firestoreService';
import { getCurrentSession } from '../firebase/sessionService';
import { exportToExcel, importExcel } from '../utils/excelService';

type Student = {
  id?: string;
  studentId: string;
  name: string;
  email?: string;
  phone?: string;
  rollNo?: string;
  rollNumber?: string;
};

const ManageClassStudents = () => {
  const { id } = useLocalSearchParams();
  const [classData, setClassData] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [formData, setFormData] = useState({
    studentId: '',
    name: '',
    email: '',
    phone: '',
    rollNo: '',
  });
  const router = useRouter();
  const { showError, showSuccess, showConfirm } = useErrorModal();

  useEffect(() => {
    if (id) {
      loadClassData();
    }
  }, [id]);

  const loadClassData = async () => {
    try {
      // Load class data
      const data = await getDocument('classes', id);
      if (data) {
        setClassData(data);
      }

      // Load students from Firebase students collection by classId
      const currentSession = await getCurrentSession();
      const studentsList = await queryCollection(
        'students',
        where('classId', '==', id),
        where('sessionId', '==', currentSession?.id)
      ) as Student[];
      setStudents(studentsList);
    } catch (error) {
      showError('Failed to load class data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.studentId || !formData.name || !formData.email || !formData.rollNo) {
      showError('Please fill in all required fields (Student ID, Name, Email, Roll Number)');
      return;
    }

    try {
      const currentSession = await getCurrentSession();
      const studentData = {
        studentId: formData.studentId,
        name: formData.name,
        email: formData.email,
        phone: formData.phone || '',
        rollNo: formData.rollNo,
        classId: id,
        sessionId: currentSession?.id,
      };

      if (editingStudent && editingStudent.id) {
        // Update existing student in Firebase
        await updateDocument('students', editingStudent.id, studentData);
        showSuccess('Student updated successfully');
      } else {
        // Create new student in Firebase
        await addDocument('students', studentData);
        showSuccess('Student added successfully');
      }

      setModalVisible(false);
      setEditingStudent(null);
      setFormData({ studentId: '', name: '', email: '', phone: '', rollNo: '' });
      loadClassData();
    } catch (error: any) {
      showError(error.message || 'Failed to save student');
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      studentId: student.studentId || '',
      name: student.name || '',
      email: student.email || '',
      phone: student.phone || '',
      rollNo: student.rollNo || student.rollNumber || '',
    });
    setModalVisible(true);
  };

  const handleDelete = (student: Student) => {
    showConfirm({
      title: 'Delete Student',
      message: `Are you sure you want to delete ${student.name}?`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          // Delete from Firebase students collection
          await deleteDocument('students', student.id);
          showSuccess('Student deleted successfully');
          loadClassData();
        } catch (error: any) {
          showError('Failed to delete student');
        }
      },
    });
  };

  const handleImport = async () => {
    try {
      const data = await importExcel();
      if (!data || data.length === 0) {
        showError('No data found in file');
        return;
      }

      const currentSession = await getCurrentSession();
      let imported = 0;
      let errors: string[] = [];

      for (const row of data) {
        try {
          const studentData = {
            studentId: row['Student ID'] || row['studentId'] || row['id'] || '',
            name: row['Name'] || row['name'] || '',
            email: row['Email'] || row['email'] || '',
            phone: row['Phone'] || row['phone'] || '',
            rollNo: String(row['Roll Number'] || row['rollNo'] || row['Roll No'] || ''),
            classId: id,
            sessionId: currentSession?.id,
          };

          if (!studentData.studentId || !studentData.name || !studentData.email || !studentData.rollNo) {
            errors.push(`Row missing required fields: ${studentData.name || 'Unknown'}`);
            continue;
          }

          // Create student in Firebase students collection
          await addDocument('students', studentData);
          imported++;
        } catch (error: any) {
          errors.push(`Error importing row: ${error.message}`);
        }
      }

      if (imported > 0) {
        showSuccess(`Imported ${imported} student(s) successfully`);
        if (errors.length > 0) {
          console.warn('Import errors:', errors);
        }
        loadClassData();
      } else {
        showError('No students were imported. Please check the format.');
      }
    } catch (error: any) {
      showError(error.message || 'Failed to import students');
    }
  };

  const handleExport = async () => {
    try {
      const safeName = (classData?.name || '').replace(/[^\w\-]+/g, '_');
      const safeSection = (classData?.section || '').replace(/[^\w\-]+/g, '_');

      const exportData = students.map(student => ({
        'Student ID': student.studentId,
        Name: student.name,
        Email: student.email,
        Phone: student.phone || '',
        'Roll Number': student.rollNo || student.rollNumber || '',
      }));

      await exportToExcel(
        exportData,
        `students_${safeName}_${safeSection}.xlsx`
      );

      showSuccess('Students exported successfully');
    } catch (error: any) {
      console.error('handleExport error:', error);
      showError(error.message);
    }
  };

  if (loading) {
    return (
      <GradientBackground>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground padded={false}>
      <ScrollContainer contentClassName="px-4 sm:px-6 pt-6 pb-10 gap-4">
        <View className="mb-2">
          <TouchableOpacity onPress={() => router.back()} className="flex-row items-center gap-2 mb-3">
            <Ionicons name="chevron-back" size={18} color="#2563eb" />
            <Text className="text-sm font-semibold text-blue-600">Back</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-900">
            {classData?.name} • {classData?.section}
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-2 mb-2">
          <PrimaryButton
            title="Add Student"
            onPress={() => {
              setEditingStudent(null);
              setFormData({ studentId: '', name: '', email: '', phone: '', rollNo: '' });
              setModalVisible(true);
            }}
            className="flex-1 min-w-[120px]"
          />
          <TouchableOpacity
            onPress={() => setShowFormatModal(true)}
            className="bg-gray-600 rounded-lg px-4 py-3 flex-row items-center justify-center"
          >
            <Ionicons name="information-circle-outline" size={16} color="#fff" />
            <Text className="text-white font-semibold ml-2 text-sm">Format</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-row gap-2 mb-2">
          <PrimaryButton title="Import Excel" onPress={handleImport} className="flex-1" />
          <PrimaryButton title="Export Excel" onPress={handleExport} className="flex-1" />
        </View>

        {students.length === 0 ? (
          <GlassCard className="p-6">
            <Text className="text-center text-gray-500">No students found</Text>
          </GlassCard>
        ) : (
          students.map((student) => (
            <GlassCard key={student.id || student.studentId} className="p-4 mb-2 flex-row justify-between items-start">
              <View className="flex-1 pr-4">
                <Text className="text-lg font-semibold text-gray-900">{student.name}</Text>
                <Text className="text-gray-500 text-sm">ID: {student.studentId}</Text>
                <Text className="text-gray-500 text-sm">Email: {student.email}</Text>
                {student.rollNo || student.rollNumber ? <Text className="text-gray-500 text-sm">Roll: {student.rollNo || student.rollNumber}</Text> : null}
                {student.phone ? <Text className="text-gray-500 text-sm">Phone: {student.phone}</Text> : null}
              </View>
              <View className="gap-2">
                <TouchableOpacity
                  onPress={() => handleEdit(student)}
                  className="rounded-lg border border-gray-300 px-3 py-2 bg-white"
                >
                  <Text className="text-blue-700 text-sm font-semibold">Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(student)}
                  className="rounded-lg border border-red-300 px-3 py-2 bg-red-50"
                >
                  <Text className="text-rose-600 text-sm font-semibold">Delete</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          ))
        )}
      </ScrollContainer>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6 max-h-[80%]">
            <Text className="text-2xl font-bold mb-4">
              {editingStudent ? 'Edit Student' : 'Add Student'}
            </Text>
            <ScrollView>
              <View className="mb-4">
                <Text className="text-sm font-semibold mb-2">Student ID *</Text>
                <TextInput
                  value={formData.studentId}
                  onChangeText={(text) => setFormData({ ...formData, studentId: text })}
                  placeholder="Enter student ID"
                  className="border border-gray-300 rounded-lg p-3"
                />
              </View>
              <View className="mb-4">
                <Text className="text-sm font-semibold mb-2">Name *</Text>
                <TextInput
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Enter name"
                  className="border border-gray-300 rounded-lg p-3"
                />
              </View>
              <View className="mb-4">
                <Text className="text-sm font-semibold mb-2">Email *</Text>
                <TextInput
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  placeholder="Enter email"
                  keyboardType="email-address"
                  className="border border-gray-300 rounded-lg p-3"
                />
              </View>
              <View className="mb-4">
                <Text className="text-sm font-semibold mb-2">Roll Number *</Text>
                <TextInput
                  value={formData.rollNo}
                  onChangeText={(text) => setFormData({ ...formData, rollNo: text })}
                  placeholder="Enter roll number"
                  keyboardType="numeric"
                  className="border border-gray-300 rounded-lg p-3"
                />
              </View>
              <View className="mb-6">
                <Text className="text-sm font-semibold mb-2">Phone</Text>
                <TextInput
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  placeholder="Enter phone"
                  keyboardType="phone-pad"
                  className="border border-gray-300 rounded-lg p-3"
                />
              </View>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  className="flex-1 bg-gray-300 py-3 rounded-lg"
                >
                  <Text className="text-center font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  className="flex-1 bg-blue-600 py-3 rounded-lg"
                >
                  <Text className="text-white text-center font-semibold">Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Format Notice Modal */}
      <Modal
        visible={showFormatModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFormatModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center px-4">
          <View className="bg-white rounded-xl p-5 max-h-[90%]">
            <View className="flex-row items-center justify-between mb-4">
              <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center">
                <Ionicons name="information-circle" size={24} color="#2563eb" />
              </View>
              <TouchableOpacity
                onPress={() => setShowFormatModal(false)}
                className="p-2"
              >
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text className="text-2xl font-bold text-gray-900 mb-2">Excel Format Required</Text>
            <Text className="text-gray-600 mb-6">
              Please ensure your Excel file follows this exact format for students:
            </Text>

            <ScrollView className="max-h-96">
              <View className="bg-gray-50 rounded-xl p-4 mb-4">
                <Text className="text-sm font-mono text-gray-800 mb-2">
                  Column Headers (Row 1):
                </Text>
                <View className="bg-white rounded-lg p-3 border border-gray-200">
                  <Text className="text-xs font-mono text-gray-700">
                    Student ID | Name | Email | Phone | Roll Number
                  </Text>
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-900 mb-2">
                  Required Columns:
                </Text>
                <View className="space-y-2">
                  <View className="flex-row items-center">
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text className="text-sm text-gray-700 ml-2">
                      <Text className="font-bold">Student ID</Text> - Unique identifier (required)
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text className="text-sm text-gray-700 ml-2">
                      <Text className="font-bold">Name</Text> - Full name (required)
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text className="text-sm text-gray-700 ml-2">
                      <Text className="font-bold">Email</Text> - Email address (required)
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text className="text-sm text-gray-700 ml-2">
                      <Text className="font-bold">Roll Number</Text> - Student roll number (required)
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons name="checkmark-circle" size={16} color="#6B7280" />
                    <Text className="text-sm text-gray-700 ml-2">
                      <Text className="font-bold">Phone</Text> - Phone number (optional)
                    </Text>
                  </View>
                </View>
              </View>

              <View className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-lg mb-4">
                <Text className="text-sm font-semibold text-blue-900 mb-1">
                  Important Notes:
                </Text>
                <Text className="text-xs text-blue-800">
                  • All required fields must be filled
                </Text>
                <Text className="text-xs text-blue-800">
                  • Students will be added to this class automatically
                </Text>
                <Text className="text-xs text-blue-800">
                  • Roll numbers must be unique within this class
                </Text>
                <Text className="text-xs text-blue-800">
                  • Supported formats: .xlsx, .xls, .csv
                </Text>
              </View>

              <View className="bg-gray-50 rounded-xl p-4">
                <Text className="text-sm font-semibold text-gray-900 mb-2">
                  Example:
                </Text>
                <View className="bg-white rounded-lg p-3 border border-gray-200">
                  <Text className="text-xs font-mono text-gray-700">
                    Student ID | Name | Email | Phone | Roll Number{'\n'}
                    STU001 | John Doe | john@example.com | 1234567890 | 001{'\n'}
                    STU002 | Jane Smith | jane@example.com | | 002
                  </Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setShowFormatModal(false)}
              className="bg-blue-600 rounded-xl py-4 items-center mt-6"
              activeOpacity={0.8}
            >
              <Text className="text-white font-bold text-base">I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </GradientBackground>
  );
};

export default ManageClassStudents;
