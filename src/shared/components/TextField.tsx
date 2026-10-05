import React from 'react';
import {
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

type TextInputInstance = React.ComponentRef<typeof TextInput>;

interface Props {
  label?: string;
  required?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'email-address';
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  textContentType?: TextInputProps['textContentType'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  /** Validation message — renders a red hint and tints the border. */
  error?: string;
  /** Trailing adornment, e.g. a password visibility toggle. */
  rightSlot?: React.ReactNode;
  /** Forwarded to the underlying input, e.g. to chain field focus. */
  inputRef?: React.RefObject<TextInputInstance | null>;
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
  secureTextEntry = false,
  autoCapitalize = 'sentences',
  autoCorrect = true,
  textContentType,
  returnKeyType,
  onSubmitEditing,
  error,
  rightSlot,
  inputRef,
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
      <View className="relative justify-center">
        <TextInput
          testID={testID}
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#A3ABC4"
          keyboardType={keyboardType}
          multiline={multiline}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          className={[
            'bg-white rounded-2xl px-4 py-3.5 text-neutral-900 font-lato text-base border',
            error ? 'border-red-500' : 'border-neutral-200',
            rightSlot ? 'pr-12' : '',
          ].join(' ')}
          style={multiline ? { textAlignVertical: 'top' } : undefined}
        />
        {rightSlot ? (
          <View className="absolute right-0 pr-4">{rightSlot}</View>
        ) : null}
      </View>
      {error ? (
        <Text className="text-red-500 font-lato text-xs mt-1.5 ml-1">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
