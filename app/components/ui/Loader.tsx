import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

type LoaderProps = { message?: string; className?: string };

export function Loader({ message, className = '' }: LoaderProps) {
  return (
    <View className={'flex-1 items-center justify-center py-16 ' + className}>
      <ActivityIndicator size="large" color="#2563eb" />
      {message ? <Text className="text-sm text-neutral-500 mt-4">{message}</Text> : null}
    </View>
  );
}
