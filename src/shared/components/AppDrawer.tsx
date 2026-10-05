import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

/** Width of the left edge strip that starts a swipe-to-open gesture. */
const EDGE_WIDTH = 24;
/** Below 1:1 so the panel feels weighted rather than glued to the finger. */
const SLIDE_FRICTION = 0.6;
const DURATION = 260;

interface DrawerContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const noop = () => {};

const DrawerContext = createContext<DrawerContextValue>({
  isOpen: false,
  open: noop,
  close: noop,
  toggle: noop,
});

/**
 * Safe to call outside AppDrawerProvider — the header's menu button then
 * simply renders without doing anything, rather than crashing.
 */
export function useDrawer() {
  return useContext(DrawerContext);
}

export function AppDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  const value = useMemo(
    () => ({ isOpen, open, close, toggle }),
    [close, isOpen, open, toggle],
  );

  return (
    <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#001C39',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0A1A3D',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 6, height: 0 },
    elevation: 24,
  },
});

interface AppDrawerProps {
  /** Content rendered inside the sliding panel. */
  drawer: React.ReactNode;
  children: React.ReactNode;
}

export function AppDrawer({ drawer, children }: AppDrawerProps) {
  const { isOpen, open, close } = useDrawer();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(320, Math.round(width * 0.84));

  const progress = useRef(new Animated.Value(0)).current;
  const dragValue = useRef(0);
  const isDragging = useRef(false);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const settle = useCallback(
    (toValue: number) => {
      dragValue.current = toValue;
      Animated.timing(progress, {
        toValue,
        duration: DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [progress],
  );

  // React state drives the resting position; an in-flight drag owns it instead.
  useEffect(() => {
    if (!isDragging.current) {
      settle(isOpen ? 1 : 0);
    }
  }, [isOpen, settle]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        close();
        return true;
      },
    );
    return () => subscription.remove();
  }, [close, isOpen]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) => {
          const isHorizontal =
            Math.abs(gesture.dx) > 6 &&
            Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
          if (!isHorizontal) {
            return false;
          }
          if (isOpenRef.current) {
            return gesture.dx < 0;
          }
          return gesture.x0 <= EDGE_WIDTH && gesture.dx > 0;
        },
        onPanResponderGrant: () => {
          isDragging.current = true;
        },
        onPanResponderMove: (_, gesture) => {
          const base = isOpenRef.current ? 1 : 0;
          const next = Math.min(
            1,
            Math.max(0, base + (gesture.dx / panelWidth) * SLIDE_FRICTION),
          );
          dragValue.current = next;
          progress.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          isDragging.current = false;
          if (gesture.vx > 0.5) {
            open();
          } else if (gesture.vx < -0.5) {
            close();
          } else if (dragValue.current > 0.5) {
            open();
          } else {
            close();
          }
        },
        onPanResponderTerminate: () => {
          isDragging.current = false;
          if (dragValue.current > 0.5) {
            open();
          } else {
            close();
          }
        },
      }),
    [close, open, panelWidth, progress],
  );

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-panelWidth, 0],
  });

  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.45],
  });

  return (
    <View style={styles.root} {...panResponder.panHandlers}>
      {children}

      <Animated.View
        pointerEvents={isOpen ? 'auto' : 'none'}
        style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable
          style={styles.fill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close navigation"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          { width: panelWidth, transform: [{ translateX }] },
        ]}>
        {drawer}
      </Animated.View>
    </View>
  );
}
