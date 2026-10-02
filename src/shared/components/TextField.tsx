import React from 'react';
import { StyleProp, Text, TextInput, View, ViewStyle } from 'react-native';

interface Props {
  label?: string;
  required?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'email-address';
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function TextField({
  label,
  required = false,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = 'default',
  className = '',
  style,
  testID,
}: Props) {
  return (
    <View className={`mb-4 ${className}`} style={style}>
      {label && (
        <Text className="text-neutral-700 font-lato-bold text-xs mb-1.5 ml-1">
          {label}
          {required ? ' *' : ''}
        </Text>
      )}
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A3ABC4"
        keyboardType={keyboardType}
        multiline={multiline}
        className={[
          'bg-white rounded-2xl px-4 py-3.5 text-neutral-900 font-lato text-base border border-neutral-200',
          multiline ? 'min-h-[88px]' : '',
        ].join(' ')}
        style={multiline ? { textAlignVertical: 'top' } : undefined}
      />
    </View>
  );
}
