import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useErrorModal } from '../components/ErrorModal';
import { GlassCard, GradientBackground, PrimaryButton, ScrollContainer } from '../components/ui/kit';
import { addDocument, deleteDocument, getCollection, updateDocument } from '../firebase/firestoreService';
import { exportToExcel, importExcel, generateTeacherTemplate } from '../utils/excelService';

const ManageTeachers = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    id: '',
    email: '',
    phone: '',
  });
  const router = useRouter();
  const { showError, showConfirm, showSuccess } = useErrorModal();

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    try {
      const teachersList = await getCollection('teachers');
      setTeachers(teachersList);
    } catch (error) {
      showError('Failed to load teachers');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.id || !formData.email) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      if (editingTeacher) {
        await updateDocument('teachers', editingTeacher.id, formData);
      } else {
        await addDocument('teachers', formData);
      }
      setModalVisible(false);
      setEditingTeacher(null);
      setFormData({ name: '', id: '', email: '', phone: '' });
      loadTeachers();
    } catch (error) {
      showError('Failed to save teacher');
    }
  };

  const handleEdit = (teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      name: teacher.name || '',
      id: teacher.id || '',
      email: teacher.email || '',
      phone: teacher.phone || '',
    });
    setModalVisible(true);
  };

  const handleDelete = (teacherId) => {
    showConfirm({
      title: 'Delete Teacher',
      message: 'Are you sure you want to delete this teacher?',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await deleteDocument('teachers', teacherId);
          loadTeachers();
        } catch (error) {
          showError('Failed to delete teacher');
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

      // Import teachers one by one
      for (const row of data) {
        await addDocument('teachers', {
          name: row['Name'] || row['name'],
          id: row['Teacher ID'] || row['id'] || row['teacherId'],
          email: row['Email'] || row['email'],
          phone: row['Phone'] || row['phone'] || '',
        });
      }
      showSuccess(`${data.length} teachers imported successfully`);
      loadTeachers();
    } catch (error) {
      showError('Failed to import teachers');
    }
  };

  const handleExport = async () => {
    try {
      const exportData = teachers.map(teacher => ({
        'Teacher ID': teacher.id,
        'Name': teacher.name,
        'Email': teacher.email,
        'Phone': teacher.phone || '',
        'Department': 'DCSE',
      }));
      await exportToExcel(exportData, 'teachers.xlsx');
      showSuccess('Teachers exported successfully');
    } catch (error) {
      showError('Failed to export teachers');
    }
  };

  const handleExportTemplate = async () => {
    try {
      const template = generateTeacherTemplate();
      await exportToExcel(template, 'teachers_template.xlsx');
      showSuccess('Template exported successfully');
    } catch (error: any) {
      showError(error.message || 'Failed to export template');
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
          <Text className="text-2xl font-bold text-gray-900">Manage Teachers</Text>
        </View>

        <View className="flex-row flex-wrap gap-2 mb-2">
          <PrimaryButton
            title="Add Teacher"
            onPress={() => {
              setEditingTeacher(null);
              setFormData({ name: '', id: '', email: '', phone: '' });
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
          <TouchableOpacity
            onPress={handleExportTemplate}
            className="bg-gray-600 rounded-lg px-4 py-3 flex-row items-center justify-center"
          >
            <Ionicons name="document-outline" size={16} color="#fff" />
            <Text className="text-white font-semibold ml-2 text-sm">Template</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-row gap-2 mb-2">
          <PrimaryButton title="Import Excel" onPress={handleImport} className="flex-1" />
          <PrimaryButton title="Export Excel" onPress={handleExport} className="flex-1" />
        </View>

        {teachers.length === 0 ? (
          <GlassCard className="p-6">
            <Text className="text-center text-gray-500">No teachers found</Text>
          </GlassCard>
        ) : (
          teachers.map((teacher) => (
            <GlassCard key={teacher.id} className="p-4">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-4">
                  <Text className="text-base font-semibold text-gray-900 mb-1">{teacher.name}</Text>
                  <Text className="text-gray-600 text-sm">ID: {teacher.id}</Text>
                  <Text className="text-gray-600 text-sm">Email: {teacher.email}</Text>
                  {teacher.phone ? <Text className="text-gray-600 text-sm">Phone: {teacher.phone}</Text> : null}
                </View>
                <View className="gap-2">
                  <TouchableOpacity
                    onPress={() => handleEdit(teacher)}
                    className="rounded-lg border border-gray-300 px-3 py-2 bg-white"
                  >
                    <Text className="text-gray-700 text-sm font-semibold">Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(teacher.id)}
                    className="rounded-lg border border-red-300 px-3 py-2 bg-red-50"
                  >
                    <Text className="text-red-600 text-sm font-semibold">Delete</Text>
                  </TouchableOpacity>
                </View>
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
              {editingTeacher ? 'Edit Teacher' : 'Add Teacher'}
            </Text>
            <ScrollView>
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
                <Text className="text-sm font-semibold mb-2">Teacher ID *</Text>
                <TextInput
                  value={formData.id}
                  onChangeText={(text) => setFormData({ ...formData, id: text })}
                  placeholder="Enter teacher ID"
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
                Please ensure your Excel file follows this exact format for teachers:
              </Text>

              <ScrollView className="max-h-96">
                <View className="bg-gray-50 rounded-xl p-4 mb-4">
                  <Text className="text-sm font-mono text-gray-800 mb-2">
                    Column Headers (Row 1):
                  </Text>
                  <View className="bg-white rounded-lg p-3 border border-gray-200">
                    <Text className="text-xs font-mono text-gray-700">
                      Teacher ID | Name | Email | Phone | Department
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
                        <Text className="font-bold">Teacher ID</Text> - Unique identifier (required)
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
                      <Ionicons name="checkmark-circle" size={16} color="#6B7280" />
                      <Text className="text-sm text-gray-700 ml-2">
                        <Text className="font-bold">Phone</Text> - Phone number (optional)
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Ionicons name="checkmark-circle" size={16} color="#6B7280" />
                      <Text className="text-sm text-gray-700 ml-2">
                        <Text className="font-bold">Department</Text> - Department name (optional, defaults to DCSE)
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
                    • Teacher IDs must be unique
                  </Text>
                  <Text className="text-xs text-blue-800">
                    • Teachers can register using their Teacher ID after being added
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
                      Teacher ID | Name | Email | Phone | Department{'\n'}
                      TCH001 | Jane Smith | jane@example.com | 1234567890 | DCSE{'\n'}
                      TCH002 | John Doe | john@example.com | | DCSE
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

export default ManageTeachers;
