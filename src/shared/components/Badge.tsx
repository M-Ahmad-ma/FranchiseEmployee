import React from 'react';
import { Text, View } from 'react-native';

export type BadgeTone = 'primary' | 'success' | 'neutral' | 'secondary';

const toneClasses: Record<BadgeTone, string> = {
  primary: 'bg-primary-200',
  success: 'bg-[#00A572]',
  neutral: 'bg-neutral-200',
  secondary: 'bg-secondary-200',
};

const textClasses: Record<BadgeTone, string> = {
  primary: 'text-primary-700',
  success: 'text-white',
  neutral: 'text-neutral-700',
  secondary: 'text-secondary-700',
};

interface Props {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
}

export function Badge({ label, tone = 'primary', dot = false }: Props) {
  return (
    <View
      className={`rounded-full px-3.5 py-1.5 flex-row items-center gap-1.5 ${
        toneClasses[tone]
      } ${tone === 'success' ? 'shadow-lg' : ''}`}>
      {dot && <View className="w-2 h-2 rounded-full bg-[#00A572]" />}
      <Text className={`font-lato-bold text-xs ${textClasses[tone]}`}>
        {label}
      </Text>
    </View>
  );
}
