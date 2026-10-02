import React from 'react';
import { Text, View } from 'react-native';
import { Info } from 'lucide-react-native';

interface Props {
  message: string;
}

/** Full-width cyan banner used for empty table/filter results. */
export function AlertBanner({ message }: Props) {
  return (
    <View className="w-full bg-tertiary-200 border border-tertiary-300 rounded-2xl px-4 py-3.5 flex-row items-center gap-2.5">
      <Info size={18} color="#0081A7" />
      <Text className="font-lato text-sm text-tertiary-900 flex-1 leading-5">
        {message}
      </Text>
    </View>
  );
}
