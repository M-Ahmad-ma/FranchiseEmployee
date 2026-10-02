import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

export const cardShadow: StyleProp<ViewStyle> = {
  shadowColor: '#0A1A3D',
  shadowOpacity: 0.12,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
};

interface Props {
  children: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, className = 'bg-white rounded-2xl', style }: Props) {
  return (
    <View className={className} style={[cardShadow, style]}>
      {children}
    </View>
  );
}
