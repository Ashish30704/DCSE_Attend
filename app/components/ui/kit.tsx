import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ChildrenProps = React.PropsWithChildren<{ className?: string }>;

export const GradientBackground: React.FC<
  React.PropsWithChildren<{ padded?: boolean }>
> = ({ children, padded = true }) => {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={["#f8fafc", "#f1f5f9"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <View
        className={"flex-1 " + (padded ? "px-4 pb-8 sm:px-6 lg:px-8" : "")}
        style={{
          paddingTop: padded
            ? Math.max(insets.top, 16)
            : Math.max(insets.top, 0),
        }}
      >
        {children}
      </View>
    </LinearGradient>
  );
};

export const GlassCard: React.FC<ChildrenProps> = ({
  children,
  className = "",
}) => (
  <View
    className={"rounded-2xl bg-white border border-neutral-200 " + className}
    style={{
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 2,
    }}
  >
    {children}
  </View>
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
> = ({
  title,
  onPress,
  loading,
  disabled,
  icon,
  className = "",
  backgroundClass,
  textClass,
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled || loading}
    className={`flex-row items-center justify-center rounded-2xl py-3 px-4 gap-2 ${backgroundClass} ${
      disabled ? "opacity-70" : ""
    } ${className}`}
  >
    {loading ? (
      <ActivityIndicator
        color={textClass.includes("text-white") ? "#ffffff" : "#1f2937"}
      />
    ) : (
      <>
        {icon}
        <Text className={`text-base font-semibold ${textClass}`}>{title}</Text>
      </>
    )}
  </TouchableOpacity>
);

export const PrimaryButton: React.FC<ButtonProps> = (props) => (
  <ButtonBase
    {...props}
    backgroundClass="bg-primary-600"
    textClass="text-white"
  />
);

export const SecondaryButton: React.FC<ButtonProps> = (props) => (
  <ButtonBase
    {...props}
    backgroundClass="bg-white border border-neutral-200"
    textClass="text-neutral-800"
  />
);

export const SectionHeading: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <View className="mb-5 flex-row items-center justify-between gap-3">
    <View className="flex-1">
      <Text className="text-lg font-semibold text-neutral-900">{title}</Text>
      {description ? (
        <Text className="text-sm text-neutral-500 mt-0.5">{description}</Text>
      ) : null}
    </View>
    {action}
  </View>
);

export const StatCard: React.FC<{
  label: string;
  value: string | number;
  accent?: string;
  icon?: React.ReactNode;
}> = ({ label, value, accent = "bg-primary-50", icon }) => (
  <GlassCard className="p-3 flex-1 min-w-[140px]">
    <View className="flex-row items-center gap-3">
      {<View
        className={
          "w-11 h-11 rounded-xl items-center justify-center " +
          (accent || "bg-primary-50")
        }
      >
        {icon}
      </View>}
      <View className="flex-1 min-w-0">
        <Text className="text-xs font-medium text-neutral-500 mb-1">
          {label}
        </Text>
        {typeof value === "string" ? (
          <Text
            className="text-base font-bold text-neutral-900"
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : (
          <Text className="text-xl font-bold text-neutral-900">{value}</Text>
        )}
      </View>
    </View>
  </GlassCard>
);

export const PillTag: React.FC<{
  text: string;
  variant?: "default" | "outline";
}> = ({ text, variant = "default" }) => (
  <View
    className={
      "px-3 py-1.5 rounded-full " +
      (variant === "outline"
        ? "bg-white border border-neutral-200"
        : "bg-primary-50")
    }
  >
    <Text
      className={
        (variant === "outline" ? "text-neutral-700" : "text-primary-700") +
        " text-xs font-semibold"
      }
    >
      {text}
    </Text>
  </View>
);

export const ScrollContainer: React.FC<
  React.PropsWithChildren<{
    contentClassName?: string;
    className?: string;
    showsVerticalScrollIndicator?: boolean;
  }>
> = ({
  children,
  contentClassName = "",
  className = "",
  showsVerticalScrollIndicator = false,
}) => (
  <ScrollView
    className={"flex-1 " + className}
    contentContainerClassName={"pb-20 " + contentClassName}
    showsVerticalScrollIndicator={showsVerticalScrollIndicator}
  >
    {children}
  </ScrollView>
);
