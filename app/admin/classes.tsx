import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

  // Teachers who are already incharge of another class (exclude current editing class so current incharge stays selectable)
  const inchargeByTeacherId = React.useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((c) => {
      const tid = c.inchargeTeacherId || c.inchargeTeacherUid || c.teacherId;
      if (tid && c.id !== editingClass?.id) map.set(tid, c.name || c.id);
    });
    return map;
  }, [classes, editingClass?.id]);

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      showError('Please enter class name');
      return;
    }
    const tid = formData.inchargeTeacherId || formData.inchargeTeacherUid;
    if (tid) {
      const otherClass = inchargeByTeacherId.get(tid);
      if (otherClass) {
        showError(`This teacher is already incharge of "${otherClass}". Each class can have only one incharge, and a teacher can be incharge of only one class.`);
        return;
      }
    }

    try {
      const classData = {
        name: formData.name.trim(),
        inchargeTeacherId: formData.inchargeTeacherId || null,
        inchargeTeacherUid: formData.inchargeTeacherUid || null,
        teacherId: formData.inchargeTeacherId || null,
      };

      if (editingClass) {
        await updateDocument('classes', editingClass.id, classData);
      } else {
        await addDocument('classes', classData);
      }
      setModalVisible(false);
      setEditingClass(null);
      setFormData({ name: '', inchargeTeacherId: '', inchargeTeacherUid: '' });
      loadData();
    } catch (error) {
      showError('Failed to save class');
    }
  };

  const handleEdit = (classItem) => {
    setEditingClass(classItem);
    setFormData({
      name: classItem.name || '',
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
            classId: classId,
            sessionId: currentSession?.id,
          };
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
        'Name': student.name,
        'Email': student.email,
        'Phone': student.phone || '',
        'Roll Number': student.rollNo || student.rollNumber || '',
      }));
      await exportToExcel(exportData, `class_${classItem.name}_students.xlsx`);
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
            setFormData({ name: '', inchargeTeacherId: '', inchargeTeacherUid: '' });
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
                    {classItem.name}
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
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end">
          <View className="flex-1 justify-end bg-black/50">
            <View className="bg-white rounded-t-3xl p-6 max-h-[80%]">
              <Text className="text-2xl font-bold mb-4">
                {editingClass ? 'Edit Class' : 'Add Class'}
              </Text>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View className="mb-4">
                <Text className="text-sm font-semibold mb-2">Class Name *</Text>
                <TextInput
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="e.g., B.Tech CSE"
                  className="border border-gray-300 rounded-lg p-3"
                />
              </View>
              <View className="mb-6">
                <Text className="text-sm font-semibold mb-2">Assign Class Incharge</Text>
                <ScrollView className="max-h-40">
                  {teachers.length > 0 ? (
                    teachers.map((teacher) => {
                      const tid = teacher.id || teacher.uid;
                      const alreadyInchargeOf = inchargeByTeacherId.get(tid);
                      const isDisabled = !!alreadyInchargeOf;
                      const isSelected = formData.inchargeTeacherId === tid;
                      return (
                        <TouchableOpacity
                          key={tid}
                          onPress={() => !isDisabled && handleSelectIncharge(teacher)}
                          disabled={isDisabled}
                          className={`p-3 mb-2 rounded-lg border-2 ${
                            isSelected ? 'bg-blue-100 border-blue-600' : isDisabled ? 'bg-gray-100 border-gray-200 opacity-80' : 'bg-gray-50 border-gray-300'
                          }`}
                        >
                          <Text className="font-semibold">{teacher.name}</Text>
                          <Text className="text-sm text-gray-600">{teacher.email}</Text>
                          {isDisabled ? (
                            <Text className="text-xs text-amber-600 mt-1">Already incharge of another class</Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })
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
        </KeyboardAvoidingView>
      </Modal>
    </GradientBackground>
  );
};

export default ManageClasses;
