import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, Pressable, View, Text, TouchableOpacity } from 'react-native';

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

const getColorClasses = (type: ModalConfig['type']) => {
  switch (type) {
    case 'success':
      return { accent: 'text-green-600', border: 'border-green-200', icon: '✅' };
    case 'info':
      return { accent: 'text-blue-600', border: 'border-blue-200', icon: 'ℹ️' };
    case 'warning':
      return { accent: 'text-amber-600', border: 'border-amber-200', icon: '⚠️' };
    case 'error':
    default:
      return { accent: 'text-red-600', border: 'border-red-200', icon: '⚠️' };
  }
};

const getButtonClasses = (variant: ModalAction['variant']) => {
  switch (variant) {
    case 'secondary':
      return 'bg-gray-100 text-gray-800';
    case 'danger':
      return 'bg-red-600 text-white';
    case 'ghost':
      return 'bg-transparent text-gray-600';
    case 'primary':
    default:
      return 'bg-blue-600 text-white';
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
        title: modalConfig.title ?? (modalConfig.type === 'success' ? 'Success' : 'Notice'),
        message: modalConfig.message ?? '',
        type: modalConfig.type ?? 'error',
        actions:
          modalConfig.actions ??
          [
            {
              label: 'Close',
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

  const colorClasses = getColorClasses(config?.type);

  return (
    <ErrorModalContext.Provider value={contextValue}>
      {children}
      <Modal transparent visible={!!config} animationType="fade" onRequestClose={hideModal}>
        <Pressable
          className="flex-1 bg-black/50 items-center justify-center px-6"
          onPress={config?.dismissOnBackdrop === false ? undefined : hideModal}
        >
          <Pressable
            className={`w-full max-w-sm rounded-2xl bg-white p-5 border ${colorClasses.border}`}
            onPress={(event) => event.stopPropagation()}
          >
            <View className="flex-row items-center gap-3 mb-3">
              <Text className={`text-2xl ${colorClasses.accent}`}>{colorClasses.icon}</Text>
              <Text className="text-lg font-semibold text-gray-900 flex-1">{config?.title}</Text>
            </View>
            <Text className="text-gray-700 mb-5">{config?.message}</Text>
            <View className="flex-row justify-end gap-2">
              {(config?.actions ?? []).map((action, index) => (
                <TouchableOpacity
                  key={`${action.label}-${index}`}
                  onPress={() => {
                    action.onPress?.();
                    if (action.onPress !== hideModal) {
                      hideModal();
                    }
                  }}
                  className={`px-4 py-2 rounded-lg ${getButtonClasses(action.variant)}`}
                >
                  <Text className="font-semibold">{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ErrorModalContext.Provider>
  );
};

export const useErrorModal = () => {
  const context = useContext(ErrorModalContext);
  if (!context) {
    throw new Error('useErrorModal must be used within ErrorModalProvider');
  }
  return context;
};

