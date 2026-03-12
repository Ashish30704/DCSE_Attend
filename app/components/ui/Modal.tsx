import React from 'react';
import {
  Modal as RNModal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ModalProps = React.PropsWithChildren<{
  visible: boolean;
  onRequestClose?: () => void;
  transparent?: boolean;
  animationType?: 'none' | 'slide' | 'fade';
  contentClassName?: string;
  /** When true, modal card fills available height (up to 90%) so scroll + sticky footer work */
  fillHeight?: boolean;
}>;

export function Modal({
  visible,
  onRequestClose,
  transparent = true,
  animationType = 'slide',
  contentClassName = '',
  fillHeight = false,
  children,
}: ModalProps) {
  const insets = useSafeAreaInsets();
  const paddingBottom = Math.max(insets.bottom, 16);
  const paddingTop = Math.max(insets.top, 16);

  return (
    <RNModal
      visible={visible}
      transparent={transparent}
      animationType={animationType}
      onRequestClose={onRequestClose}
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
    >
      <Pressable
        style={[styles.overlay, Platform.OS === 'web' && styles.overlayWeb]}
        onPress={onRequestClose}
      >
        <Pressable
          style={[
            styles.card,
            fillHeight && styles.cardFill,
            { paddingBottom, paddingTop },
            Platform.OS === 'web' && styles.cardWeb,
          ]}
          className={`bg-white rounded-t-3xl ${contentClassName}`}
          onPress={(e) => e.stopPropagation()}
        >
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  overlayWeb: {
    minHeight: '100vh',
  },
  card: {
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16,
  },
  cardFill: {
    flex: 1,
    minHeight: 0,
  },
  cardWeb: {
    maxWidth: 480,
    marginHorizontal: 'auto',
    borderRadius: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
});
