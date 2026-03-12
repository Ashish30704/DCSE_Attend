import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useErrorModal } from '../components/ErrorModal';
import { GlassCard, GradientBackground, PrimaryButton, ScrollContainer } from '../components/ui/kit';
import { addDocument, deleteDocument, getCollection, queryCollection, updateDocument, getDocument } from '../firebase/firestoreService';
import { getCurrentSession } from '../firebase/sessionService';
import { toStoredPhone, isValidIndianPhone } from '../utils/phoneUtils';

const ManageStudents = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    rollNo: '',
    classId: '',
  });
  const router = useRouter();
  const { showError, showConfirm, showSuccess } = useErrorModal();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentSession = await getCurrentSession();
      // Load students filtered by current session
      const studentsList = await queryCollection(
        'students',
        where('sessionId', '==', currentSession?.id)
      );
      const classesList = await getCollection('classes');
      setStudents(studentsList);
      setFilteredStudents(studentsList);
      setClasses(classesList);
    } catch (error) {
      showError('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name?.trim() || !formData.email?.trim() || !formData.rollNo?.trim() || !formData.classId) {
      showError('Please fill in name, email, roll number, and class');
      return;
    }
    const phoneRaw = (formData.phone || '').trim().replace(/\D/g, '');
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
        classId: formData.classId,
        sessionId: currentSession?.id,
      };

      if (editingStudent?.id) {
        await updateDocument('students', editingStudent.id, studentData);
      } else {
        await addDocument('students', studentData);
      }
      showSuccess(editingStudent ? 'Student updated successfully' : 'Student added successfully');
      setModalVisible(false);
      resetForm();
      loadData();
    } catch (error: any) {
      showError(error.message || 'Failed to save student');
    }
  };

  const handleDelete = (student: any) => {
    showConfirm({
      title: 'Delete Student',
      message: `Are you sure you want to delete ${student.name}?`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await deleteDocument('students', student.id);
          showSuccess('Student deleted successfully');
          loadData();
        } catch (error) {
          showError('Failed to delete student');
        }
      },
    });
  };

  // Filter and search functionality
  useEffect(() => {
    let filtered = [...students];

    // Filter by class
    if (selectedClassFilter !== 'all') {
      filtered = filtered.filter((student) => student.classId === selectedClassFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (student) =>
          student.name?.toLowerCase().includes(query) ||
          student.email?.toLowerCase().includes(query) ||
          student.rollNo?.toLowerCase().includes(query) ||
          student.rollNumber?.toLowerCase().includes(query)
      );
    }

    setFilteredStudents(filtered);
  }, [students, searchQuery, selectedClassFilter]);

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      rollNo: '',
      classId: '',
    });
    setEditingStudent(null);
  };

  const openEditModal = (student: any) => {
    setEditingStudent(student);
    const rawPhone = (student.phone || '').replace(/^\+91/, '').replace(/\D/g, '').slice(0, 10);
    setFormData({
      name: student.name || '',
      email: student.email || '',
      phone: rawPhone,
      rollNo: student.rollNo || student.rollNumber || '',
      classId: student.classId || '',
    });
    setModalVisible(true);
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

  return (
    <GradientBackground padded={false}>
      <ScrollContainer contentClassName="px-4 sm:px-6 pt-6 pb-10 gap-4">
        <View className="mb-2">
          <TouchableOpacity onPress={() => router.back()} className="flex-row items-center gap-2 mb-3">
            <Ionicons name="chevron-back" size={18} color="#2563eb" />
            <Text className="text-sm font-semibold text-blue-600">Back</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-900 mb-1">Manage Students</Text>
          <Text className="text-sm text-gray-600 mb-1">Search, filter, and manage student records</Text>
          <Text className="text-xs text-gray-500">Note: Import/Export available in Manage Classes</Text>
        </View>

        <View className="mb-2">
          <View className="flex-row items-center bg-white rounded-lg px-4 py-3 border border-gray-300">
            <Ionicons name="search-outline" size={20} color="#9ca3af" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name, email, or roll number..."
              className="flex-1 ml-3 text-gray-900"
              placeholderTextColor="#9ca3af"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Class Filter */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-gray-700 mb-2">Filter by Class</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setSelectedClassFilter('all')}
                className={`px-4 py-2 rounded-full border flex-row items-center gap-2 ${
                  selectedClassFilter === 'all' ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'
                }`}
              >
                <Ionicons name="apps" size={16} color={selectedClassFilter === 'all' ? '#fff' : '#6b7280'} />
                <Text
                  className={
                    selectedClassFilter === 'all' ? 'text-white font-semibold' : 'text-gray-700 font-semibold'
                  }
                >
                  All Classes
                </Text>
              </TouchableOpacity>
              {classes.map((classItem) => (
                <TouchableOpacity
                  key={classItem.id}
                  onPress={() => setSelectedClassFilter(classItem.id)}
                  className={`px-4 py-2 rounded-full border flex-row items-center gap-2 ${
                    selectedClassFilter === classItem.id ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'
                  }`}
                >
                  <Ionicons
                    name="school-outline"
                    size={16}
                    color={selectedClassFilter === classItem.id ? '#fff' : '#6b7280'}
                  />
                  <Text
                    className={
                      selectedClassFilter === classItem.id ? 'text-white font-semibold' : 'text-gray-700 font-semibold'
                    }
                  >
                    {classItem.name} {classItem.section ? `• ${classItem.section}` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* <TouchableOpacity
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
          className="bg-blue-600 rounded-lg px-4 py-3 flex-row items-center justify-center mb-2"
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text className="text-white font-bold text-base ml-2">Add New Student</Text>
        </TouchableOpacity> */}

        {filteredStudents.length === 0 ? (
          <GlassCard className="p-6">
            <Text className="text-center text-gray-500">
              {searchQuery || selectedClassFilter !== 'all'
                ? 'No students match your search criteria.'
                : 'No students found. Add students through Manage Classes to get started.'}
            </Text>
          </GlassCard>
        ) : (
          <>
            <View className="mb-2">
              <Text className="text-sm text-gray-500">
                Showing {filteredStudents.length} of {students.length} students
              </Text>
            </View>
            {filteredStudents.map((student) => (
            <GlassCard key={student.id} className="p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-gray-900">{student.name}</Text>
                  <Text className="text-sm text-gray-500">Roll: {student.rollNo || student.rollNumber || 'N/A'}</Text>
                  <Text className="text-sm text-gray-500">Email: {student.email}</Text>
                </View>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => openEditModal(student)}
                    className="bg-white border border-gray-300 px-3 py-2 rounded-lg"
                  >
                    <Ionicons name="pencil-outline" size={18} color="#2563eb" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(student)}
                    className="bg-red-50 border border-red-300 px-3 py-2 rounded-lg"
                  >
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </View>
            </GlassCard>
            ))}
          </>
        )}

        <Modal visible={modalVisible} transparent animationType="slide">
          <View className="flex-1 bg-black/50 justify-center px-4">
            <View className="bg-white rounded-xl p-5 max-h-[90%]">
              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-2xl font-bold text-gray-900">
                    {editingStudent ? 'Edit Student' : 'Add Student'}
                  </Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View className="space-y-4">
                  <View>
                    <Text className="text-sm font-semibold text-gray-700 mb-2">Name *</Text>
                    <TextInput
                      value={formData.name}
                      onChangeText={(text) => setFormData({ ...formData, name: text })}
                      placeholder="John Doe"
                      className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 text-gray-900"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <View>
                    <Text className="text-sm font-semibold text-gray-700 mb-2">Roll Number *</Text>
                    <TextInput
                      value={formData.rollNo}
                      onChangeText={(text) => setFormData({ ...formData, rollNo: text })}
                      placeholder="1"
                      keyboardType="numeric"
                      className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 text-gray-900"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <View>
                    <Text className="text-sm font-semibold text-gray-700 mb-2">Email *</Text>
                    <TextInput
                      value={formData.email}
                      onChangeText={(text) => setFormData({ ...formData, email: text })}
                      placeholder="student@dcse.edu"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 text-gray-900"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <View>
                    <Text className="text-sm font-semibold text-gray-700 mb-2">Phone</Text>
                    <TextInput
                      value={formData.phone}
                      onChangeText={(text) => setFormData({ ...formData, phone: text.replace(/\D/g, '').slice(0, 10) })}
                      placeholder="10-digit number"
                      keyboardType="phone-pad"
                      maxLength={10}
                      className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 text-gray-900"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <View>
                    <Text className="text-sm font-semibold text-gray-700 mb-2">Class *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                      {classes.map((cls) => (
                        <TouchableOpacity
                          key={cls.id}
                          onPress={() => setFormData({ ...formData, classId: cls.id })}
                          className={`px-4 py-2 rounded-xl border ${
                            formData.classId === cls.id
                              ? 'bg-blue-600 border-blue-600'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <Text
                            className={`font-semibold ${
                              formData.classId === cls.id ? 'text-white' : 'text-gray-700'
                            }`}
                          >
                            {cls.name} {cls.section || ''}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                <View className="flex-row gap-3 mt-6">
                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    className="flex-1 bg-gray-200 rounded-xl py-3 items-center"
                  >
                    <Text className="text-gray-700 font-semibold">Cancel</Text>
                  </TouchableOpacity>
                  <PrimaryButton
                    title={editingStudent ? 'Update' : 'Add'}
                    onPress={handleSave}
                    className="flex-1"
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScrollContainer>
    </GradientBackground>
  );
};

export default ManageStudents;
