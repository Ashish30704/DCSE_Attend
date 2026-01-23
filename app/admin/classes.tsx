import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useErrorModal } from '../components/ErrorModal';
import { GlassCard, GradientBackground, PrimaryButton, ScrollContainer } from '../components/ui/kit';
import { addDocument, deleteDocument, getCollection, queryCollection, updateDocument } from '../firebase/firestoreService';
import { getCurrentSession } from '../firebase/sessionService';
import { exportToExcel, importExcel } from '../utils/excelService';

// Component to display student count from Firebase
const ClassStudentCount = ({ classId }: { classId: string }) => {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCount = async () => {
      try {
        const currentSession = await getCurrentSession();
        const studentsList = await queryCollection(
          'students',
          where('classId', '==', classId),
          where('sessionId', '==', currentSession?.id)
        );
        setCount(studentsList.length);
      } catch (error) {
        console.error('Error loading student count:', error);
      } finally {
        setLoading(false);
      }
    };
    if (classId) {
      loadCount();
    }
  }, [classId]);

  if (loading) {
    return <Text className="text-gray-500 text-sm">Students: ...</Text>;
  }
  return <Text className="text-gray-500 text-sm">Students: {count}</Text>;
};

const ManageClasses = () => {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    section: '',
    inchargeTeacherId: '',
    inchargeTeacherUid: '',
  });
  const router = useRouter();
  const { showError, showSuccess, showConfirm } = useErrorModal();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [classesList, teachersList] = await Promise.all([
        getCollection('classes'),
        getCollection('teachers'),
      ]);

      setClasses(classesList);
      setTeachers(teachersList.map((t) => ({ ...t, uid: t.uid })));
    } catch (error) {
      showError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.section) {
      showError('Please fill in class name and section');
      return;
    }

    try {
      const classData = {
        name: formData.name,
        section: formData.section,
        inchargeTeacherId: formData.inchargeTeacherId || null,
        inchargeTeacherUid: formData.inchargeTeacherUid || null,
        // keep legacy field populated for backwards compatibility
        teacherId: formData.inchargeTeacherId || null,
      };

      if (editingClass) {
        await updateDocument('classes', editingClass.id, classData);
      } else {
        await addDocument('classes', classData);
      }
      setModalVisible(false);
      setEditingClass(null);
      setFormData({ name: '', section: '', inchargeTeacherId: '', inchargeTeacherUid: '' });
      loadData();
    } catch (error) {
      showError('Failed to save class');
    }
  };

  const handleEdit = (classItem) => {
    setEditingClass(classItem);
    setFormData({
      name: classItem.name || '',
      section: classItem.section || '',
      inchargeTeacherId: classItem.inchargeTeacherId || classItem.teacherId || '',
      inchargeTeacherUid: classItem.inchargeTeacherUid || '',
    });
    setModalVisible(true);
  };

  const handleDelete = (classId) => {
    showConfirm({
      title: 'Delete Class',
      message: 'Are you sure you want to delete this class?',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await deleteDocument('classes', classId);
          loadData();
        } catch (error) {
          showError('Failed to delete class');
        }
      },
    });
  };

  const handleImportStudents = async (classId) => {
    try {
      const data = await importExcel();
      if (!data || data.length === 0) {
        showError('No data found in file');
        return;
      }

      const { getCurrentSession } = await import('../firebase/sessionService');
      const { addDocument } = await import('../firebase/firestoreService');
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
            classId: classId,
            sessionId: currentSession?.id,
          };

          if (!studentData.studentId || !studentData.name || !studentData.email || !studentData.rollNo) {
            errors.push(`Row missing required fields: ${studentData.name || 'Unknown'}`);
            continue;
          }

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
        loadData();
      } else {
        showError('No students were imported. Please check the format.');
      }
    } catch (error: any) {
      showError(error.message || 'Failed to import students');
    }
  };

  const handleExportStudents = async (classItem) => {
    try {
      const { queryCollection } = await import('../firebase/firestoreService');
      const { getCurrentSession } = await import('../firebase/sessionService');
      const { where } = await import('firebase/firestore');
      const currentSession = await getCurrentSession();
      
      // Load students from Firebase
      const studentsList = await queryCollection(
        'students',
        where('classId', '==', classItem.id),
        where('sessionId', '==', currentSession?.id)
      );

      const exportData = studentsList.map(student => ({
        'Student ID': student.studentId,
        'Name': student.name,
        'Email': student.email,
        'Phone': student.phone || '',
        'Roll Number': student.rollNo || student.rollNumber || '',
      }));
      await exportToExcel(exportData, `class_${classItem.name}_${classItem.section}_students.xlsx`);
      showSuccess('Students exported successfully');
    } catch (error) {
      showError('Failed to export students');
    }
  };

  const handleSelectIncharge = (teacher) => {
    setFormData((prev) => ({
      ...prev,
      inchargeTeacherId: teacher.id || teacher.uid || '',
      inchargeTeacherUid: teacher.uid || '',
    }));
  };

  const resolveInchargeId = (classItem) =>
    classItem.inchargeTeacherId || classItem.teacherId || '';

  const getTeacherName = (teacherId) => {
    if (!teacherId) return 'Not assigned';
    const teacher = teachers.find(
      (t) => t.id === teacherId || t.uid === teacherId
    );
    return teacher ? teacher.name : 'Not assigned';
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
          <Text className="text-2xl font-bold text-gray-900">Manage Classes</Text>
        </View>

        <PrimaryButton
          title="Add New Class"
          onPress={() => {
            setEditingClass(null);
            setFormData({ name: '', section: '', inchargeTeacherId: '', inchargeTeacherUid: '' });
            setModalVisible(true);
          }}
        />

        {classes.length === 0 ? (
          <GlassCard className="p-6">
            <Text className="text-center text-gray-500">No classes found</Text>
          </GlassCard>
        ) : (
          classes.map((classItem) => (
            <GlassCard key={classItem.id} className="p-4">
              <View className="flex-row justify-between items-start mb-3">
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-gray-900 mb-1">
                    {classItem.name} • {classItem.section}
                  </Text>
                  <Text className="text-gray-600 text-sm mb-1">
                    Incharge: <Text className="font-semibold text-gray-900">{getTeacherName(resolveInchargeId(classItem))}</Text>
                  </Text>
                  <ClassStudentCount classId={classItem.id} />
                </View>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => handleEdit(classItem)}
                    className="rounded-lg border border-gray-300 px-3 py-2 bg-white"
                  >
                    <Text className="text-gray-700 text-sm font-semibold">Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(classItem.id)}
                    className="rounded-lg border border-red-300 px-3 py-2 bg-red-50"
                  >
                    <Text className="text-red-600 text-sm font-semibold">Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => router.push(`/admin/class-students?id=${classItem.id}`)}
                className="bg-blue-600 rounded-lg py-3 justify-center items-center"
              >
                <Text className="text-white font-semibold text-sm">Manage Students</Text>
              </TouchableOpacity>
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
              {editingClass ? 'Edit Class' : 'Add Class'}
            </Text>
            <ScrollView>
              <View className="mb-4">
                <Text className="text-sm font-semibold mb-2">Class Name *</Text>
                <TextInput
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="e.g., B.Tech CSE"
                  className="border border-gray-300 rounded-lg p-3"
                />
              </View>
              <View className="mb-4">
                <Text className="text-sm font-semibold mb-2">Section *</Text>
                <TextInput
                  value={formData.section}
                  onChangeText={(text) => setFormData({ ...formData, section: text })}
                  placeholder="e.g., A, B, C"
                  className="border border-gray-300 rounded-lg p-3"
                />
              </View>
              <View className="mb-6">
                <Text className="text-sm font-semibold mb-2">Assign Class Incharge</Text>
                <ScrollView className="max-h-40">
                  {teachers.length > 0 ? (
                    teachers.map((teacher) => (
                      <TouchableOpacity
                        key={teacher.id || teacher.uid}
                        onPress={() => handleSelectIncharge(teacher)}
                        className={`p-3 mb-2 rounded-lg border-2 ${
                          formData.inchargeTeacherId === (teacher.id || teacher.uid)
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

export default ManageClasses;
