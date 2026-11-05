import React from 'react';
import { Text, View } from 'react-native';
import { Card } from './Card';

export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-4">
      <Text className="font-lato-bold text-[10px] uppercase tracking-[1px] text-neutral-600 mb-1.5">
        {title}
      </Text>
      <Card className="bg-neutral-100 rounded-2xl p-3">{children}</Card>
    </View>
  );
}

export function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-2 py-1.5">
      {icon}
      <Text className="font-lato text-xs text-neutral-600 w-20">{label}</Text>
      <Text className="font-lato text-sm text-neutral-900 flex-1">
        {value}
      </Text>
    </View>
  );
}
