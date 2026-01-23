import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ChildrenProps = React.PropsWithChildren<{ className?: string }>;

export const GradientBackground: React.FC<React.PropsWithChildren<{ padded?: boolean }>> = ({
  children,
  padded = true,
}) => {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={['#f8fafc', '#f1f5f9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <View 
        className={`flex-1 ${padded ? 'px-4 pb-6 sm:px-6' : ''}`}
        style={{ paddingTop: padded ? Math.max(insets.top, 12) : Math.max(insets.top, 0) }}
      >
        {children}
      </View>
    </LinearGradient>
  );
};

export const GlassCard: React.FC<ChildrenProps> = ({ children, className = '' }) => (
  <View className={`rounded-2xl bg-white border border-gray-200 shadow-sm ${className}`}>{children}</View>
);

type ButtonProps = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
};

const ButtonBase: React.FC<
  ButtonProps & {
    backgroundClass: string;
    textClass: string;
  }
> = ({ title, onPress, loading, disabled, icon, className = '', backgroundClass, textClass }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled || loading}
    className={`flex-row items-center justify-center rounded-2xl py-3 px-4 gap-2 ${backgroundClass} ${
      disabled ? 'opacity-70' : ''
    } ${className}`}
  >
    {loading ? (
      <ActivityIndicator color={textClass.includes('text-white') ? '#ffffff' : '#1f2937'} />
    ) : (
      <>
        {icon}
        <Text className={`text-base font-semibold ${textClass}`}>{title}</Text>
      </>
    )}
  </TouchableOpacity>
);

export const PrimaryButton: React.FC<ButtonProps> = (props) => (
  <ButtonBase {...props} backgroundClass="bg-blue-600" textClass="text-white" />
);

export const SecondaryButton: React.FC<ButtonProps> = (props) => (
  <ButtonBase {...props} backgroundClass="bg-white border border-gray-300" textClass="text-gray-700" />
);

export const SectionHeading: React.FC<{ title: string; description?: string; action?: React.ReactNode }> = ({
  title,
  description,
  action,
}) => (
  <View className="mb-4 flex-row items-center justify-between gap-3">
    <View className="flex-1">
      <Text className="text-lg font-semibold text-gray-900">{title}</Text>
      {description ? <Text className="text-sm text-gray-500">{description}</Text> : null}
    </View>
    {action}
  </View>
);

export const StatCard: React.FC<{ label: string; value: string | number; accent?: string; icon?: React.ReactNode }> = ({
  label,
  value,
  accent = 'bg-blue-50',
  icon,
}) => (
  <GlassCard className="p-4 flex-1 min-w-[140px]">
    <View className="flex-row items-center gap-3">
      <View className={`w-10 h-10 rounded-xl items-center justify-center ${accent}`}>{icon}</View>
      <View className="flex-1">
        <Text className="text-xs text-gray-500 mb-1">{label}</Text>
        {typeof value === 'string' ? (
          <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>{value}</Text>
        ) : (
          <Text className="text-2xl font-bold text-gray-900">{value}</Text>
        )}
      </View>
    </View>
  </GlassCard>
);

export const PillTag: React.FC<{ text: string; variant?: 'default' | 'outline' }> = ({ text, variant = 'default' }) => (
  <View
    className={`px-3 py-2 rounded-full ${
      variant === 'outline' ? 'bg-white border border-gray-300' : 'bg-blue-50'
    }`}
  >
    <Text className={`${variant === 'outline' ? 'text-gray-700' : 'text-blue-700'} text-xs font-semibold`}>{text}</Text>
  </View>
);

export const ScrollContainer: React.FC<
  React.PropsWithChildren<{ contentClassName?: string; className?: string; showsVerticalScrollIndicator?: boolean }>
> = ({ children, contentClassName = '', className = '', showsVerticalScrollIndicator = false }) => (
  <ScrollView
    className={`flex-1 ${className}`}
    contentContainerClassName={`pb-16 ${contentClassName}`}
    showsVerticalScrollIndicator={showsVerticalScrollIndicator}
  >
    {children}
  </ScrollView>
);

