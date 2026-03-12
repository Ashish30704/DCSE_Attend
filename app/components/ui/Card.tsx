import React from 'react';
import { View } from 'react-native';

type CardProps = React.PropsWithChildren<{ className?: string; padded?: boolean }>;

export function Card({ children, className = '', padded = true }: CardProps) {
  const base = 'rounded-2xl bg-white border border-neutral-200 ';
  const pad = padded ? 'p-5 ' : '';
  return <View className={base + pad + className}>{children}</View>;
}
