import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { PageMeta } from '../../services/httpClient';

interface Props {
  meta: PageMeta;
  onChange: (page: number) => void;
  disabled?: boolean;
}

/**
 * Page stepper for the one endpoint that paginates server-side.
 *
 * Shows the window the API returned rather than every page, so a 500-page
 * result set still renders a compact control.
 */
function windowFor(pages: number) {
  if (pages <= 7) {
    return Array.from({ length: pages }, (_, index) => index + 1);
  }
  return [1, 2, 3, 4, 5, 6, pages];
}

/** Previous / page numbers / next, with the current page marked. */
export function Pagination({ meta, onChange, disabled = false }: Props) {
  const { page, pages, total, per_page } = meta;
  const lastPage = Math.max(1, pages);
  const isFirst = page <= 1;
  const isLast = page >= lastPage;
  const firstRow = (page - 1) * per_page + 1;
  const lastRow = Math.min(page * per_page, total);

  if (total === 0) {
    return null;
  }

  const step = (next: number) => {
    if (disabled) {
      return;
    }
    onChange(Math.min(Math.max(next, 1), lastPage));
  };

  const arrowClass = (enabled: boolean) =>
    `w-9 h-9 rounded-full items-center justify-center ${
      enabled ? 'bg-primary-200' : 'bg-neutral-100'
    }`;

  return (
    <View className="px-4 py-3 border-t border-neutral-200">
      <Text className="font-lato text-xs text-neutral-600 text-center mb-3">
        {firstRow}–{lastRow} of {total}
      </Text>

      <View className="flex-row items-center justify-center gap-1">
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={disabled || isFirst}
          onPress={() => step(page - 1)}
          className={arrowClass(!isFirst)}
          accessibilityRole="button"
          accessibilityLabel="Previous page"
          accessibilityState={{ disabled: isFirst || disabled }}>
          <ChevronLeft size={16} color={isFirst ? '#A3ABC4' : '#5279AC'} />
        </TouchableOpacity>

        {windowFor(lastPage).map((number, index) => {
          const active = number === page;
          const isGap = number - page > 1 && index > 0;

          return (
            <React.Fragment key={number}>
              {isGap && number !== lastPage && (
                <Text className="font-lato text-xs text-neutral-500 px-1">
                  …
                </Text>
              )}
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={disabled}
                onPress={() => step(number)}
                className={`w-9 h-9 rounded-full items-center justify-center ${
                  active ? 'bg-primary-700' : 'bg-primary-200'
                }`}
                accessibilityRole="button"
                accessibilityLabel={`Page ${number}`}
                accessibilityState={{ selected: active, disabled }}>
                <Text
                  className={`font-lato-bold text-xs ${
                    active ? 'text-white' : 'text-primary-700'
                  }`}>
                  {number}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}

        <TouchableOpacity
          activeOpacity={0.8}
          disabled={disabled || isLast}
          onPress={() => step(page + 1)}
          className={arrowClass(!isLast)}
          accessibilityRole="button"
          accessibilityLabel="Next page"
          accessibilityState={{ disabled: isLast || disabled }}>
          <ChevronRight size={16} color={isLast ? '#A3ABC4' : '#5279AC'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}