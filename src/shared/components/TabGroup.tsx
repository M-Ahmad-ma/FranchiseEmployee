import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export interface TabItem {
  key: string;
  label: string;
}

interface Props {
  tabs: TabItem[];
  value: string;
  onChange: (key: string) => void;
}

export function TabGroup({ tabs, value, onChange }: Props) {
  return (
    <View className="flex-row flex-wrap gap-2 mb-4">
      {tabs.map(tab => {
        const active = tab.key === value;
        return (
          <TouchableOpacity
            key={tab.key}
            activeOpacity={0.8}
            onPress={() => onChange(tab.key)}
            className={`px-4 py-2 rounded-full ${
              active ? 'bg-primary-700' : 'bg-neutral-200'
            }`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}>
            <Text
              className={`text-sm font-lato-bold ${
                active ? 'text-primary-100' : 'text-neutral-700'
              }`}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
