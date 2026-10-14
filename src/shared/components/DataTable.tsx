import React from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

export interface TableColumn<T> {
  key: string;
  title: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  render?: (row: T) => React.ReactNode;
}

interface Props<T> {
  columns: TableColumn<T>[];
  data: T[];
  emptyMessage: string;
  /**
   * Makes a row tappable. Rendered as a Pressable behind the cells so the
   * column `render` functions still paint on top and stay pressable themselves.
   */
  onPressRow?: (row: T) => void;
}

const alignment = (align: TableColumn<unknown>['align']) => {
  if (align === 'center') {
    return 'center' as const;
  }
  if (align === 'right') {
    return 'flex-end' as const;
  }
  return 'flex-start' as const;
};

export function DataTable<T>({
  columns,
  data,
  emptyMessage,
  onPressRow,
}: Props<T>) {
  const { width } = useWindowDimensions();
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const viewportWidth = Math.max(width - 32, tableWidth);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ width: viewportWidth }}>
      <View style={{ width: viewportWidth }}>
        <View className="flex-row bg-primary-200">
          {columns.map(column => (
            <View
              key={column.key}
              style={{ width: column.width, alignItems: alignment(column.align) }}>
              <Text className="font-lato-bold text-[11px] tracking-[1px] uppercase text-neutral-700 px-4 py-3">
                {column.title}
              </Text>
            </View>
          ))}
        </View>

        {data.length === 0 ? (
          <View
            className="items-center justify-center py-7 border-b border-neutral-200 bg-white"
            style={{ width: viewportWidth }}>
            <Text className="text-neutral-600 font-lato text-base leading-6">
              {emptyMessage}
            </Text>
          </View>
        ) : (
          data.map((row, rowIndex) => (
            <Pressable
              key={rowIndex}
              disabled={!onPressRow}
              onPress={onPressRow ? () => onPressRow(row) : undefined}
              className="flex-row border-b border-neutral-200 bg-white"
              accessibilityRole={onPressRow ? 'button' : undefined}
              accessibilityLabel={onPressRow ? 'Open row' : undefined}>
              {columns.map(column => (
                <View
                  key={column.key}
                  style={{
                    width: column.width,
                    alignItems: alignment(column.align),
                    justifyContent: 'center',
                  }}
                  className="px-4 py-3">
                  {column.render ? (
                    column.render(row)
                  ) : (
                    <Text
                      className="font-lato text-sm text-neutral-900"
                      numberOfLines={1}>
                      {String((row as Record<string, unknown>)[column.key] ?? '')}
                    </Text>
                  )}
                </View>
              ))}
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}
