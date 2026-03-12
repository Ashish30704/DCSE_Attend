import React from 'react';
import { Image, View } from 'react-native';

type DepartmentLogoProps = {
  size?: number;
  className?: string;
};

export function DepartmentLogo({ size = 48, className = '' }: DepartmentLogoProps) {
  return (
    <View className={`overflow-hidden rounded-xl bg-white ${className}`} style={{ width: size, height: size }}>
      <Image
        source={require('../../assets/images/mainLogo.jpeg')}
        style={{ width: size, height: size }}
        resizeMode="cover"
      />
    </View>
  );
}
