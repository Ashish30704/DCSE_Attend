import React from 'react';
import { View } from 'react-native';

type ScreenLayoutProps = React.PropsWithChildren<{
  className?: string;
  /** Max width for content (web). Default content = 640px */
  maxWidth?: 'content' | 'wide' | 'full';
}>;

export function ScreenLayout({ children, className = '', maxWidth = 'content' }: ScreenLayoutProps) {
  const maxClass = maxWidth === 'wide' ? 'max-w-wide' : maxWidth === 'full' ? '' : 'max-w-content';
  return (
    <View className={'flex-1 w-full ' + (maxWidth !== 'full' ? 'mx-auto ' + maxClass + ' w-full' : '') + ' ' + className}>
      {children}
    </View>
  );
}
