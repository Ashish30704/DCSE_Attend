import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

const TeachDashboardScreen = () => {
  // Mock teacher data - replace with Redux state or API call
  const [teacherData] = useState({
    id: 'T001',
    name: 'Ashish Kumar',
    position: 'Senior Lecturer',
    gender: 'Male',
    email: 'ashish.kumar@college.edu',
    phone: '+91 98765-43210',
    department: 'Computer Science',
    profileImage: '',
  });

  // Mock classes and subjects data - replace with Redux state or API call
  const [classesData] = useState([
    {
      id: 'C001',
      className: 'B.Tech CSE - Sem 3',
      subjects: [
        { id: 'S001', name: 'Data Structures' },
        { id: 'S002', name: 'Digital Electronics' },
        { id: 'S003', name: 'Web Development' },
      ],
    },
    {
      id: 'C002',
      className: 'B.Tech CSE - Sem 4',
      subjects: [
        { id: 'S004', name: 'Database Management' },
        { id: 'S005', name: 'Software Engineering' },
      ],
    },
    {
      id: 'C003',
      className: 'B.Tech IT - Sem 3',
      subjects: [
        { id: 'S006', name: 'Computer Networks' },
        { id: 'S007', name: 'Operating Systems' },
        { id: 'S008', name: 'Algorithms' },
        { id: 'S009', name: 'Database Design' },
      ],
    },
  ]);

  // Calculate total subjects
  const totalSubjects = classesData.reduce(
    (total, classItem) => total + classItem.subjects.length,
    0
  );

  const renderClassCard = ({ item }) => (
    <View className='bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-200'>
      {/* Class Header */}
      <View className='flex-row items-center justify-between mb-3'>
        <View className='flex-row items-center gap-3 flex-1'>
          <View className='bg-blue-100 p-3 rounded-lg'>
            <Ionicons name='book' size={24} color='#3b82f6' />
          </View>
          <View className='flex-1'>
            <Text className='text-base font-bold text-gray-900'>
              {item.className}
            </Text>
            <Text className='text-xs text-gray-500 mt-1'>
              {item.subjects.length} subject{item.subjects.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Subjects List */}
      <View className='bg-gray-50 rounded-lg p-3'>
        {item.subjects.map((subject, index) => (
          <View key={subject.id}>
            <View className='flex-row items-center gap-2 py-2'>
              <View className='w-2 h-2 bg-blue-500 rounded-full' />
              <Text className='text-sm text-gray-700 flex-1'>
                {subject.name}
              </Text>
            </View>
            {index < item.subjects.length - 1 && (
              <View className='h-px bg-gray-200' />
            )}
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView
      className='flex-1 bg-gray-50'
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: Platform.OS === 'android' ? 20 : 0,
      }}
    >
      {/* Header Section - Teacher Info */}
      {/* <View className='bg-gradient-to-b from-blue-600 to-blue-500 px-4 pt-6 pb-8'> */}
      <View className='bg-blue-500 px-4 pt-6 pb-8'>
        {/* Profile Card */}
        <View className='bg-white rounded-2xl p-4 mb-4 shadow-md'>
          {/* Avatar and Basic Info */}
          <View className='flex-row items-center gap-4 mb-4'>
            {/* <View className='bg-gradient-to-br from-blue-400 to-blue-600 p-4 rounded-full items-center justify-center'> */}
            <View className='bg-blue-400 p-4 rounded-full items-center justify-center'>
              {teacherData.profileImage === '' ? (
                <Ionicons name='person' size={40} color='white' />
              ) : (
                <Image src={teacherData.profileImage} />
              )}
            </View>
            <View className='flex-1'>
              <Text className='text-xl font-bold text-gray-900'>
                {teacherData.name}
              </Text>
              <Text className='text-sm font-semibold text-blue-600 mt-1'>
                {teacherData.position}
              </Text>
              <Text className='text-xs text-gray-500 mt-1'>
                {teacherData.department}
              </Text>
            </View>
          </View>

          {/* Additional Info */}
          <View className='border-t border-gray-200 pt-4'>
            {/* Gender and ID Row */}
            <View className='flex-row justify-between mb-3'>
              <View className='flex-1 mr-2'>
                <Text className='text-xs font-semibold text-gray-500 mb-1'>
                  GENDER
                </Text>
                <View className='flex-row items-center gap-2'>
                  <Ionicons
                    name={
                      teacherData.gender === 'Male'
                        ? 'male'
                        : 'female'
                    }
                    size={18}
                    color='#6b7280'
                  />
                  <Text className='text-sm font-medium text-gray-900'>
                    {teacherData.gender}
                  </Text>
                </View>
              </View>
              <View className='flex-1'>
                <Text className='text-xs font-semibold text-gray-500 mb-1'>
                  ID
                </Text>
                <Text className='text-sm font-medium text-gray-900'>
                  {teacherData.id}
                </Text>
              </View>
            </View>

            {/* Email Row */}
            <View className='mb-3'>
              <Text className='text-xs font-semibold text-gray-500 mb-1'>
                EMAIL
              </Text>
              <View className='flex-row items-center gap-2'>
                <Ionicons name='mail' size={16} color='#3b82f6' />
                <Text className='text-sm font-medium text-gray-900'>
                  {teacherData.email}
                </Text>
              </View>
            </View>

            {/* Phone Row */}
            <View>
              <Text className='text-xs font-semibold text-gray-500 mb-1'>
                PHONE
              </Text>
              <View className='flex-row items-center gap-2'>
                <Ionicons name='call' size={16} color='#3b82f6' />
                <Text className='text-sm font-medium text-gray-900'>
                  {teacherData.phone}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Total Subjects Summary */}
        <View className='bg-white/15 rounded-xl p-3 flex-row items-center gap-3'>
          <View className='bg-slate-300 p-2 rounded-lg'>
            <Ionicons name='bar-chart' size={20} color='white' />
          </View>
          <View>
            <Text className='text-white/80 text-xs font-medium'>
              Total Classes & Subjects
            </Text>
            <Text className='text-white text-lg font-bold'>
              {classesData.length} Classes • {totalSubjects} Subjects
            </Text>
          </View>
        </View>
      </View>

      {/* Classes and Subjects Section */}
      <View className='px-4 pt-6 pb-8'>
        <View className='mb-4'>
          <Text className='text-xl font-bold text-gray-900 mb-1'>
            My Classes & Subjects
          </Text>
          <View className='h-1 w-12 bg-blue-600 rounded-full' />
        </View>

        <FlatList
          data={classesData}
          renderItem={renderClassCard}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />

        {/* Empty State Info */}
        {classesData.length === 0 && (
          <View className='items-center justify-center py-8'>
            <Ionicons name='book-outline' size={48} color='#d1d5db' />
            <Text className='text-gray-400 text-center mt-3'>
              No classes assigned yet
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default TeachDashboardScreen;

const styles = StyleSheet.create({});