import React, { useEffect } from 'react';
import { BackHandler, Platform, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MIN_TOUCH_HEIGHT = 44;
const MIN_TOUCH_WIDTH = 44;

type HeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  className?: string;
};

export function Header({ title, subtitle, onBack, right, className = '' }: HeaderProps) {
  useEffect(() => {
    if (!onBack || Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  return (
    <View className={`mb-6 ${className}`}>
      {onBack ? (
        <View className="self-start">
          <TouchableOpacity
            onPress={onBack}
            className="flex-row items-center gap-2 mb-3 rounded-xl active:opacity-80"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ minHeight: MIN_TOUCH_HEIGHT, minWidth: MIN_TOUCH_WIDTH, justifyContent: 'center', paddingLeft: 8, paddingRight: 12 }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={26} color="#2563eb" />
            <Text className="text-base font-semibold text-primary-600">Back</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 min-w-0">
          <Text className="text-2xl font-bold text-neutral-900" numberOfLines={1}>{title}</Text>
          {subtitle ? (
            <Text className="text-sm text-neutral-500 mt-1" numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}
