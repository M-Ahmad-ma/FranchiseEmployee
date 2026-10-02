import { useWindowDimensions } from 'react-native';

interface GridOptions {
  /** Total horizontal insets removed from the screen (gutters + card padding). */
  inset?: number;
  gap?: number;
  maxColumns?: number;
}

/**
 * Responsive column helper — RN has no reliable media-query breakpoints,
 * so we derive them from window width:
 *   < 640 → 1 col · 640–1023 → 2 cols · >= 1024 → 3 cols
 */
export function useGrid(options: GridOptions = {}) {
  const { width } = useWindowDimensions();
  const { inset = 32, gap = 16, maxColumns = 3 } = options;

  let columns = 1;
  if (width >= 640) {
    columns = 2;
  }
  if (width >= 1024) {
    columns = 3;
  }
  columns = Math.min(columns, maxColumns);

  const itemWidth = Math.floor((width - inset - gap * (columns - 1)) / columns);

  return { columns, gap, itemWidth, screenWidth: width };
}
