import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

type InputProps = React.ComponentProps<typeof TextInput> & {
  label?: string;
  error?: string;
  containerClassName?: string;
};

export function Input({ label, error, containerClassName = '', className = '', secureTextEntry, ...rest }: InputProps) {
  const [hidePassword, setHidePassword] = useState(true);
  const isPassword = secureTextEntry === true;
  const showToggle = isPassword;

  return (
    <View className={'mb-4 ' + containerClassName}>
      {label ? <Text className="text-sm font-medium text-neutral-700 mb-2">{label}</Text> : null}
      <View className="relative">
        <TextInput
          placeholderTextColor="#a1a1aa"
          className={'w-full py-3.5 pr-12 pl-4 rounded-xl bg-neutral-50 border text-neutral-900 ' + (error ? 'border-red-300' : 'border-neutral-200') + ' ' + className}
          secureTextEntry={isPassword ? hidePassword : secureTextEntry}
          {...rest}
        />
        {showToggle ? (
          <TouchableOpacity
            onPress={() => setHidePassword((p) => !p)}
            className="absolute right-3 top-0 bottom-0 justify-center"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <Ionicons name={hidePassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#71717a" />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text className="text-sm text-red-500 mt-1.5">{error}</Text> : null}
    </View>
  );
}
