import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { Header } from '../components/ui';
import { GlassCard, GradientBackground } from '../components/ui/kit';

const NotificationsScreen = () => {
  const router = useRouter();
  const { user } = useSelector((state: any) => state.auth);

  return (
    <GradientBackground padded={false}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 sm:px-6 pt-6 pb-12 gap-4"
        showsVerticalScrollIndicator={false}
      >
        <Header
          title="Notifications"
          subtitle="Push notifications"
          onBack={() => router.back()}
        />

        <GlassCard className="p-8">
          <View className="items-center">
            <Ionicons name="notifications-outline" size={48} color="#2563eb" />
            <Text className="text-gray-900 text-center mt-4 text-lg font-semibold">Push Notifications Enabled</Text>
            <Text className="text-gray-600 text-sm text-center mt-2">
              You'll receive push notifications on your device when your attendance is marked by a teacher.
            </Text>
            <Text className="text-gray-500 text-xs text-center mt-4">
              Notifications are sent directly to your device and appear even when the app is closed.
            </Text>
          </View>
        </GlassCard>

        <GlassCard className="p-4">
          <View className="flex-row items-start gap-3">
            <View className="w-10 h-10 rounded-xl items-center justify-center bg-blue-100">
              <Ionicons name="information-circle-outline" size={20} color="#2563eb" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900 mb-1">About Notifications</Text>
              <Text className="text-sm text-gray-600">
                When a teacher marks your attendance, you'll receive a push notification on your device indicating whether you were marked present or absent.
              </Text>
            </View>
          </View>
        </GlassCard>
      </ScrollView>
    </GradientBackground>
  );
};

export default NotificationsScreen;
