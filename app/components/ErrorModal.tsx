import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  Modal as RNModal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type ModalAction = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
};

type ModalConfig = {
  title?: string;
  message?: string;
  type?: 'error' | 'success' | 'info' | 'warning';
  actions?: ModalAction[];
  dismissOnBackdrop?: boolean;
};

type ErrorModalContextValue = {
  showModal: (config: ModalConfig) => void;
  showError: (message: string, options?: Omit<ModalConfig, 'message' | 'type'>) => void;
  showSuccess: (message: string, options?: Omit<ModalConfig, 'message' | 'type'>) => void;
  showInfo: (message: string, options?: Omit<ModalConfig, 'message' | 'type'>) => void;
  showConfirm: (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }) => void;
  hideModal: () => void;
};

const ErrorModalContext = createContext<ErrorModalContextValue | undefined>(undefined);

const ICON_MAP = {
  error: { name: 'warning-outline' as const, bg: '#FEF2F2', icon: '#DC2626' },
  success: { name: 'checkmark-circle-outline' as const, bg: '#F0FDF4', icon: '#16A34A' },
  info: { name: 'information-circle-outline' as const, bg: '#EFF6FF', icon: '#2563EB' },
  warning: { name: 'alert-circle-outline' as const, bg: '#FFFBEB', icon: '#D97706' },
};

const getButtonStyle = (variant: ModalAction['variant']) => {
  switch (variant) {
    case 'secondary':
      return { bg: '#F4F4F5', text: '#27272A' };
    case 'danger':
      return { bg: '#DC2626', text: '#FFF' };
    case 'ghost':
      return { bg: 'transparent', text: '#52525B' };
    case 'primary':
    default:
      return { bg: '#2563EB', text: '#FFF' };
  }
};

export const ErrorModalProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [config, setConfig] = useState<ModalConfig | null>(null);

  const hideModal = useCallback(() => {
    setConfig(null);
  }, []);

  const showModal = useCallback(
    (modalConfig: ModalConfig) => {
      setConfig({
        title:
          modalConfig.title ??
          (modalConfig.type === 'success' ? 'Success' : modalConfig.type === 'error' ? 'Error' : 'Notice'),
        message: modalConfig.message ?? '',
        type: modalConfig.type ?? 'error',
        actions:
          modalConfig.actions ??
          [
            {
              label: 'OK',
              variant: 'primary',
              onPress: hideModal,
            },
          ],
        dismissOnBackdrop: modalConfig.dismissOnBackdrop ?? true,
      });
    },
    [hideModal]
  );

  const showError = useCallback(
    (message: string, options?: Omit<ModalConfig, 'message' | 'type'>) => {
      showModal({
        ...options,
        message,
        type: 'error',
      });
    },
    [showModal]
  );

  const showSuccess = useCallback(
    (message: string, options?: Omit<ModalConfig, 'message' | 'type'>) => {
      showModal({
        ...options,
        message,
        type: 'success',
      });
    },
    [showModal]
  );

  const showInfo = useCallback(
    (message: string, options?: Omit<ModalConfig, 'message' | 'type'>) => {
      showModal({
        ...options,
        message,
        type: 'info',
      });
    },
    [showModal]
  );

  const showConfirm = useCallback(
    ({
      title,
      message,
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
      onConfirm,
      onCancel,
    }: {
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      onConfirm?: () => void;
      onCancel?: () => void;
    }) => {
      showModal({
        title,
        message,
        type: 'warning',
        dismissOnBackdrop: false,
        actions: [
          {
            label: cancelLabel,
            variant: 'ghost',
            onPress: () => {
              onCancel?.();
              hideModal();
            },
          },
          {
            label: confirmLabel,
            variant: 'danger',
            onPress: () => {
              hideModal();
              onConfirm?.();
            },
          },
        ],
      });
    },
    [showModal, hideModal]
  );

  const contextValue = useMemo(
    () => ({
      showModal,
      showError,
      showSuccess,
      showInfo,
      showConfirm,
      hideModal,
    }),
    [showModal, showError, showSuccess, showInfo, showConfirm, hideModal]
  );

  const type = config?.type ?? 'error';
  const iconStyle = ICON_MAP[type];

  return (
    <ErrorModalContext.Provider value={contextValue}>
      {children}
      <RNModal
        transparent
        visible={!!config}
        animationType="fade"
        onRequestClose={hideModal}
        statusBarTranslucent
        supportedOrientations={['portrait', 'landscape']}
        presentationStyle="overFullScreen"
      >
        <View style={[styles.wrapper, Platform.OS === 'web' && styles.wrapperWeb]}>
          <Pressable
            style={styles.overlay}
            onPress={config?.dismissOnBackdrop === false ? undefined : hideModal}
          >
            <Pressable
              style={[styles.card, Platform.OS === 'web' && styles.cardWeb]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.iconWrap, { backgroundColor: iconStyle.bg }]}>
                <Ionicons name={iconStyle.name} size={28} color={iconStyle.icon} />
              </View>
              <Text style={styles.title}>{config?.title}</Text>
              <Text style={styles.message}>{config?.message}</Text>
              <View style={styles.actions}>
                {(config?.actions ?? []).map((action, index) => {
                  const { bg, text } = getButtonStyle(action.variant);
                  return (
                    <TouchableOpacity
                      key={`${action.label}-${index}`}
                      onPress={() => {
                        action.onPress?.();
                        if (action.onPress !== hideModal) hideModal();
                      }}
                      style={[styles.button, { backgroundColor: bg }]}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.buttonText, { color: text }]}>{action.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Pressable>
          </Pressable>
        </View>
      </RNModal>
    </ErrorModalContext.Provider>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    elevation: 999,
    zIndex: 9999,
  },
  wrapperWeb: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 2147483647,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  cardWeb: {
    maxWidth: 360,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#18181B',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#52525B',
    lineHeight: 22,
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export const useErrorModal = () => {
  const context = useContext(ErrorModalContext);
  if (!context) {
    throw new Error('useErrorModal must be used within ErrorModalProvider');
  }
  return context;
};
