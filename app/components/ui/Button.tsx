import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  icon?: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
};

export function Button(props: ButtonProps) {
  const { title, onPress, loading, disabled, variant = 'primary', icon, className = '', fullWidth } = props;
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const bg = isPrimary ? 'bg-primary-600' : isDanger ? 'bg-red-500' : variant === 'secondary' ? 'bg-white border border-neutral-200' : 'bg-transparent';
  const text = isPrimary || isDanger ? 'text-white' : variant === 'secondary' ? 'text-neutral-800' : 'text-primary-600';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      className={'flex-row items-center justify-center rounded-2xl py-3.5 px-5 gap-2 ' + bg + (disabled || loading ? ' opacity-60' : '') + (fullWidth ? ' w-full' : '') + ' ' + className}
    >
      {loading ? <ActivityIndicator size="small" color={isPrimary || isDanger ? '#fff' : '#2563eb'} /> : null}
      {!loading && icon}
      {!loading && <Text className={'text-base font-semibold ' + text}>{title}</Text>}
    </TouchableOpacity>
  );
}
