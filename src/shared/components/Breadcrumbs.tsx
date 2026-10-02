import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

export interface Crumb {
  label: string;
  onPress?: () => void;
}

interface Props {
  items: Crumb[];
}

export function Breadcrumbs({ items }: Props) {
  return (
    <View className="flex-row flex-wrap items-center gap-1.5">
      {items.map((crumb, index) => {
        const isLast = index === items.length - 1;
        const content = (
          <Text
            className={
              isLast
                ? 'font-lato-bold text-xs text-neutral-900'
                : 'font-lato text-xs text-neutral-600'
            }>
            {crumb.label}
          </Text>
        );

        return (
          <React.Fragment key={`${crumb.label}-${index}`}>
            {crumb.onPress && !isLast ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={crumb.onPress}
                accessibilityRole="button">
                {content}
              </TouchableOpacity>
            ) : (
              content
            )}
            {!isLast && (
              <ChevronRight size={14} color="#8990A8" style={{ marginHorizontal: 1 }} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}
