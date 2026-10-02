import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'inverted'
  | 'outlined'
  | 'link';

export type ButtonSize = 'sm' | 'lg';

const containerBase = 'flex-row items-center justify-center gap-2';
const textBase = 'font-lato-bold text-base';

const variantContainer: Record<ButtonVariant, string> = {
  primary: 'bg-primary-700',
  secondary: 'bg-secondary-700',
  inverted: 'bg-primary-dark',
  outlined: 'bg-transparent border border-primary-700',
  link: 'bg-transparent border-none',
};

const variantText: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-white',
  inverted: 'text-white',
  outlined: 'text-primary-700',
  link: 'text-primary-700',
};

const sizeContainer: Record<ButtonSize, string> = {
  sm: 'px-5 py-2 rounded-xl',
  lg: 'rounded-2xl py-4',
};

interface Props {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'sm',
  disabled = false,
  loading = false,
  icon,
  className = '',
  testID,
}: Props) {
  const isDisabled = disabled || loading;
  const spinnerColor =
    variant === 'primary' || variant === 'secondary' || variant === 'inverted'
      ? '#FFFFFF'
      : '#5279AC';

  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={size === 'lg' ? 0.85 : 0.8}
      disabled={isDisabled}
      onPress={onPress}
      className={[
        containerBase,
        variantContainer[variant],
        sizeContainer[size],
        isDisabled && !loading ? 'opacity-50' : '',
        className,
      ].join(' ')}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}>
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <>
          {icon}
          <Text className={`${textBase} ${variantText[variant]}`}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
