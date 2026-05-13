/**
 * Lightweight loading placeholder — avoids blank screen while data loads.
 * Uses static Views (no animation lib) to keep bundle and CPU cost low.
 */
import React from 'react';
import { View } from 'react-native';

type Props = {
  /** Number of placeholder rows */
  rows?: number;
};

export const ScreenSkeleton: React.FC<Props> = ({ rows = 4 }) => (
  <View className="px-4 pt-6 gap-4 flex-1">
    <View className="h-8 w-48 rounded-lg bg-neutral-200/80" />
    <View className="h-24 w-full rounded-2xl bg-neutral-200/60" />
    {Array.from({ length: rows }).map((_, i) => (
      <View key={i} className="h-16 w-full rounded-xl bg-neutral-100" />
    ))}
  </View>
);
