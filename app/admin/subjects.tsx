import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useErrorModal } from '../components/ErrorModal';
import { GlassCard, GradientBackground, PillTag, PrimaryButton, ScrollContainer } from '../components/ui/kit';
import { addDocument, deleteDocument, getCollection, updateDocument } from '../firebase/firestoreService';

const ManageSubjects = () => {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    classId: '',
    subjectTeacherId: '',
    subjectTeacherUid: '',
  });
  const router = useRouter();
  const { showError, showConfirm, showSuccess } = useErrorModal();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [subjectsList, classesList, teachersList] = await Promise.all([
        getCollection('subjects'),
        getCollection('classes'),
        getCollection('teachers'),
      ]);

      setSubjects(subjectsList);
      setClasses(classesList);
      setTeachers(teachersList);
    } catch (error) {
      showError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code || !formData.classId) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      const subjectData = {
        name: formData.name,
        code: formData.code,
        classId: formData.classId,
        subjectTeacherId: formData.subjectTeacherId || null,
        subjectTeacherUid: formData.subjectTeacherUid || null,
        // legacy field for compatibility
        teacherId: formData.subjectTeacherId || null,
      };

      if (editingSubject) {
        await updateDocument('subjects', editingSubject.id, subjectData);
      } else {
        await addDocument('subjects', subjectData);
      }
      setModalVisible(false);
      setEditingSubject(null);
      setFormData({ name: '', code: '', classId: '', subjectTeacherId: '', subjectTeacherUid: '' });
      loadData();
    } catch (error) {
      showError('Failed to save subject');
    }
  };

  const handleDelete = (subjectId) => {
    showConfirm({
      title: 'Delete Subject',
      message: 'Are you sure you want to delete this subject?',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await deleteDocument('subjects', subjectId);
          loadData();
        } catch (error) {
          showError('Failed to delete subject');
        }
      },
    });
  };

  const getTeacherName = (teacherId) => {
    if (!teacherId) return 'Not assigned';
    const teacher = teachers.find(
      (t) => t.id === teacherId || t.uid === teacherId
    );
    return teacher ? teacher.name : 'Not assigned';
  };

  const getClassName = (classId) => {
    const classItem = classes.find(c => c.id === classId);
    return classItem ? `${classItem.name} - ${classItem.section}` : 'Unknown';
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
          <Text className="text-2xl font-bold text-gray-900">Manage Subjects</Text>
        </View>

        <PrimaryButton
          title="Add Subject"
          onPress={() => {
            setEditingSubject(null);
            setFormData({ name: '', code: '', classId: '', subjectTeacherId: '', subjectTeacherUid: '' });
            setModalVisible(true);
          }}
        />

        {subjects.length === 0 ? (
          <GlassCard className="p-6">
            <Text className="text-center text-gray-500">No subjects found</Text>
          </GlassCard>
        ) : (
          subjects.map((subject) => (
            <GlassCard key={subject.id} className="p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-4">
                  <Text className="text-base font-semibold text-gray-900 mb-2">{subject.name}</Text>
                  <View className="flex-row flex-wrap gap-2 mb-2">
                    <PillTag text={`Code: ${subject.code}`} />
                    <PillTag text={getClassName(subject.classId)} variant="outline" />
                  </View>
                  <Text className="text-gray-600 text-sm">
                    Teacher: {getTeacherName(subject.subjectTeacherId || subject.teacherId)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(subject.id)}
                  className="rounded-lg border border-red-300 px-3 py-2 bg-red-50"
                >
                  <Text className="text-red-600 text-sm font-semibold">Delete</Text>
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
              {editingSubject ? 'Edit Subject' : 'Add Subject'}
            </Text>
            <ScrollView>
              <View className="mb-4">
                <Text className="text-sm font-semibold mb-2">Subject Name *</Text>
                <TextInput
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="e.g., Data Structures"
                  className="border border-gray-300 rounded-lg p-3"
                />
              </View>
              <View className="mb-4">
                <Text className="text-sm font-semibold mb-2">Subject Code *</Text>
                <TextInput
                  value={formData.code}
                  onChangeText={(text) => setFormData({ ...formData, code: text })}
                  placeholder="e.g., CS301"
                  className="border border-gray-300 rounded-lg p-3"
                />
              </View>
              <View className="mb-6">
                <Text className="text-sm font-semibold mb-2">Class *</Text>
                <ScrollView className="max-h-40">
                  {classes.map((classItem) => (
                    <TouchableOpacity
                      key={classItem.id}
                      onPress={() => setFormData({ ...formData, classId: classItem.id })}
                      className={`p-3 mb-2 rounded-lg border-2 ${
                        formData.classId === classItem.id
                          ? 'bg-blue-100 border-blue-600'
                          : 'bg-gray-50 border-gray-300'
                      }`}
                    >
                      <Text className="font-semibold">
                        {classItem.name} - {classItem.section}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View className="mb-6">
                <Text className="text-sm font-semibold mb-2">Assign Subject Teacher</Text>
                <ScrollView className="max-h-40">
                  {teachers.length > 0 ? (
                    teachers.map((teacher) => (
                      <TouchableOpacity
                        key={teacher.id || teacher.uid}
                        onPress={() =>
                          setFormData({
                            ...formData,
                            subjectTeacherId: teacher.id || teacher.uid,
                            subjectTeacherUid: teacher.uid || '',
                          })
                        }
                        className={`p-3 mb-2 rounded-lg border-2 ${
                          formData.subjectTeacherId === (teacher.id || teacher.uid)
                            ? 'bg-blue-100 border-blue-600'
                            : 'bg-gray-50 border-gray-300'
                        }`}
                      >
                        <Text className="font-semibold">{teacher.name}</Text>
                        <Text className="text-sm text-gray-600">{teacher.email}</Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text className="text-gray-500 text-sm p-3">No teachers available</Text>
                  )}
                </ScrollView>
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
    </GradientBackground>
  );
};

export default ManageSubjects;
