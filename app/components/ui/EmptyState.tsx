import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type EmptyStateProps = {
  icon?: 'folder-open-outline' | 'document-text-outline' | 'people-outline' | 'school-outline';
  title: string;
  description?: string;
  className?: string;
};

export function EmptyState({ icon = 'folder-open-outline', title, description, className = '' }: EmptyStateProps) {
  return (
    <View className={'items-center justify-center py-12 px-6 ' + className}>
      <View className="w-16 h-16 rounded-2xl bg-neutral-100 items-center justify-center mb-4">
        <Ionicons name={icon} size={28} color="#71717a" />
      </View>
      <Text className="text-base font-medium text-neutral-700 text-center">{title}</Text>
      {description ? <Text className="text-sm text-neutral-500 text-center mt-2 max-w-[280px]">{description}</Text> : null}
    </View>
  );
}
