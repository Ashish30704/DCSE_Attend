import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useErrorModal } from '../components/ErrorModal';
import { Header, Modal } from '../components/ui';
import { GlassCard, GradientBackground, PrimaryButton, ScrollContainer } from '../components/ui/kit';
import { addDocument, deleteDocument, getDocument, queryCollection, updateDocument } from '../firebase/firestoreService';
import { getCurrentSession } from '../firebase/sessionService';
import { toStoredPhone, isValidIndianPhone } from '../utils/phoneUtils';
import { exportToExcel, importExcel } from '../utils/excelService';

type Student = {
  id?: string;
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

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showFormatModal) {
        setShowFormatModal(false);
        return true;
      }
      if (modalVisible) {
        setModalVisible(false);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [modalVisible, showFormatModal]);

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
    if (!formData.name?.trim() || !formData.email?.trim() || !formData.rollNo?.trim()) {
      showError('Please fill in Name, Email, and Roll Number');
      return;
    }
    const phoneRaw = (formData.phone || '').replace(/\D/g, '').slice(0, 10);
    if (phoneRaw && !isValidIndianPhone(phoneRaw)) {
      showError('Please enter a valid 10-digit phone number');
      return;
    }

    try {
      const currentSession = await getCurrentSession();
      const studentData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: phoneRaw ? toStoredPhone(phoneRaw) : '',
        rollNo: formData.rollNo.trim(),
        classId: id,
        sessionId: currentSession?.id,
      };

      if (editingStudent?.id) {
        await updateDocument('students', editingStudent.id, studentData);
        showSuccess('Student updated successfully');
      } else {
        await addDocument('students', studentData);
        showSuccess('Student added successfully');
      }

      setModalVisible(false);
      setEditingStudent(null);
      setFormData({ name: '', email: '', phone: '', rollNo: '' });
      loadClassData();
    } catch (error: any) {
      showError(error.message || 'Failed to save student');
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    const rawPhone = (student.phone || '').replace(/^\+91/, '').replace(/\D/g, '').slice(0, 10);
    setFormData({
      name: student.name || '',
      email: student.email || '',
      phone: rawPhone,
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
          const name = row['Name'] ?? row['name'];
          const email = row['Email'] ?? row['email'];
          const rollNo = String(row['Roll Number'] ?? row['rollNo'] ?? row['Roll No'] ?? '');
          if (!name || !email || !rollNo) {
            errors.push(`Row missing required fields (Name, Email, Roll Number): ${name || 'Unknown'}`);
            continue;
          }
          const studentData = {
            name,
            email,
            phone: row['Phone'] ?? row['phone'] ?? '',
            rollNo,
            classId: id,
            sessionId: currentSession?.id,
          };

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

      const exportData = students.map(student => ({
        Name: student.name,
        Email: student.email,
        Phone: student.phone || '',
        'Roll Number': student.rollNo || student.rollNumber || '',
      }));

      await exportToExcel(exportData, `students_${safeName}.xlsx`);

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
        <Header
          title={classData?.name ?? 'Students'}
          onBack={() => router.back()}
        />

        <View className="flex-row flex-wrap gap-2 mb-2">
          <PrimaryButton
            title="Add Student"
            onPress={() => {
              setEditingStudent(null);
              setFormData({ name: '', email: '', phone: '', rollNo: '' });
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
            <GlassCard key={student.id} className="p-4 mb-2 flex-row justify-between items-start">
              <View className="flex-1 pr-4">
                <Text className="text-lg font-semibold text-gray-900">{student.name}</Text>
                <Text className="text-gray-500 text-sm">Roll: {student.rollNo || student.rollNumber}</Text>
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
        onRequestClose={() => setModalVisible(false)}
        contentClassName="p-6 flex-1 min-h-0"
        fillHeight
      >
        <View className="flex-1 min-h-0">
          <Text className="text-xl font-bold text-neutral-900 mb-4">
            {editingStudent ? 'Edit Student' : 'Add Student'}
          </Text>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className="mb-4">
              <Text className="text-sm font-semibold text-neutral-700 mb-2">Name *</Text>
              <TextInput
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Enter name"
                className="border border-neutral-300 rounded-xl px-4 py-3 bg-white text-neutral-900"
                placeholderTextColor="#a1a1aa"
              />
            </View>
            <View className="mb-4">
              <Text className="text-sm font-semibold text-neutral-700 mb-2">Email *</Text>
              <TextInput
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                placeholder="Enter email"
                keyboardType="email-address"
                className="border border-neutral-300 rounded-xl px-4 py-3 bg-white text-neutral-900"
                placeholderTextColor="#a1a1aa"
              />
            </View>
            <View className="mb-4">
              <Text className="text-sm font-semibold text-neutral-700 mb-2">Roll Number *</Text>
              <TextInput
                value={formData.rollNo}
                onChangeText={(text) => setFormData({ ...formData, rollNo: text })}
                placeholder="Enter roll number"
                keyboardType="numeric"
                className="border border-neutral-300 rounded-xl px-4 py-3 bg-white text-neutral-900"
                placeholderTextColor="#a1a1aa"
              />
            </View>
            <View className="mb-4">
              <Text className="text-sm font-semibold text-neutral-700 mb-2">Phone</Text>
              <TextInput
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text.replace(/\D/g, '').slice(0, 10) })}
                placeholder="10-digit number"
                keyboardType="phone-pad"
                maxLength={10}
                className="border border-neutral-300 rounded-xl px-4 py-3 bg-white text-neutral-900"
                placeholderTextColor="#a1a1aa"
              />
            </View>
          </ScrollView>
          <View className="flex-row gap-3 pt-2 border-t border-neutral-100">
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              className="flex-1 bg-neutral-100 py-3.5 rounded-xl min-h-[44px] justify-center"
              activeOpacity={0.8}
            >
              <Text className="text-center font-semibold text-neutral-700">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              className="flex-1 bg-primary-600 py-3.5 rounded-xl min-h-[44px] justify-center"
              activeOpacity={0.8}
            >
              <Text className="text-white text-center font-semibold">Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Format Notice Modal */}
      <Modal
        visible={showFormatModal}
        onRequestClose={() => setShowFormatModal(false)}
        contentClassName="p-6 flex-1 min-h-0"
        fillHeight
      >
        <View className="flex-1 min-h-0">
          <View className="flex-row items-center gap-3 mb-4">
            <View className="w-12 h-12 bg-primary-100 rounded-2xl items-center justify-center">
              <Ionicons name="information-circle" size={24} color="#2563eb" />
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-neutral-900">Excel Format Required</Text>
              <Text className="text-sm text-neutral-500 mt-0.5">
                Please ensure your file follows this format
              </Text>
            </View>
          </View>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="bg-neutral-100 rounded-xl p-4 mb-4">
              <Text className="text-sm font-semibold text-neutral-800 mb-2">Column Headers (Row 1):</Text>
              <View className="bg-white rounded-lg p-3 border border-neutral-200">
                <Text className="text-xs font-mono text-neutral-700">
                  Name | Email | Phone | Roll Number
                </Text>
              </View>
            </View>
            <View className="mb-4">
              <Text className="text-sm font-semibold text-neutral-900 mb-2">Required columns</Text>
              <View className="gap-2">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text className="text-sm text-neutral-700"><Text className="font-semibold">Name</Text> – required</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text className="text-sm text-neutral-700"><Text className="font-semibold">Email</Text> – required</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text className="text-sm text-neutral-700"><Text className="font-semibold">Roll Number</Text> – required</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={16} color="#6B7280" />
                  <Text className="text-sm text-neutral-700"><Text className="font-semibold">Phone</Text> – optional</Text>
                </View>
              </View>
            </View>
            <View className="bg-primary-50 border-l-4 border-primary-500 p-3 rounded-lg mb-4">
              <Text className="text-sm font-semibold text-primary-900 mb-1">Notes</Text>
              <Text className="text-xs text-primary-800">• Required fields must be filled{'\n'}• Roll numbers unique per class{'\n'}• Formats: .xlsx, .xls, .csv</Text>
            </View>
            <View className="bg-neutral-100 rounded-xl p-4">
              <Text className="text-sm font-semibold text-neutral-900 mb-2">Example</Text>
              <View className="bg-white rounded-lg p-3 border border-neutral-200">
                <Text className="text-xs font-mono text-neutral-700">
                  Name | Email | Phone | Roll Number{'\n'}John Doe | john@example.com | 1234567890 | 001{'\n'}Jane Smith | jane@example.com | | 002
                </Text>
              </View>
            </View>
          </ScrollView>
          <View className="pt-2 border-t border-neutral-100">
            <TouchableOpacity
              onPress={() => setShowFormatModal(false)}
              className="bg-primary-600 rounded-xl py-3.5 min-h-[44px] justify-center"
              activeOpacity={0.8}
            >
              <Text className="text-white text-center font-semibold">I understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </GradientBackground>
  );
};

export default ManageClassStudents;
