import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, ChevronRight, X } from 'lucide-react-native';
import {
  fetchFollowupsBell,
  followUpState,
  type FollowUp,
} from '../services/followupsService';
import { hasSession } from '../services/httpClient';
import { FollowUpCard } from '../features/followUps/FollowUpCard';
import type { RootStackParamList } from '../navigation/types';

const REFRESH_INTERVAL_MS = 60_000;
const DURATION = 260;
/** Below 1:1 so the panel feels weighted rather than glued to the finger. */
const SLIDE_FRICTION = 0.6;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#001C39',
  },
  panel: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0A1A3D',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: -6, height: 0 },
    elevation: 24,
  },
});

/**
 * Notifications are ordered by what needs doing first, not by the order the
 * server sent them: overdue rows on top, then the ones due soonest, then
 * anything already closed. The endpoint returns the most recent rows, which
 * is the wrong order for a queue you are working through.
 */
function byUrgency(a: FollowUp, b: FollowUp) {
  const rank = { overdue: 0, active: 1, done: 2 } as const;
  const diff = rank[followUpState(a)] - rank[followUpState(b)];
  if (diff !== 0) {
    return diff;
  }
  return (a.date || '').localeCompare(b.date || '');
}

/**
 * Header bell for `GET /api/team/followups/bell`.
 *
 * The badge refreshes when the screen gains focus and then on a slow interval,
 * so a scheduled follow-up shows up without the user hunting for the screen.
 * A failed poll is swallowed — the badge is ambient information, and a network
 * blip should not surface an error over whatever the screen is doing.
 *
 * Tapping it opens a right-hand drawer rather than a centred dialog, so it
 * reads as part of the app's navigation instead of an interruption. The
 * drawer is read-only: it lists what the server already knows and links to
 * the follow-ups screen, which is where anything is changed.
 */
export function FollowUpsBell() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(360, Math.round(width * 0.86));

  const [count, setCount] = useState(0);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  /** Whether the drawer is open. */
  const [open, setOpen] = useState(false);
  /**
   * Kept separate from `open` so the panel can animate out before the modal
   * is torn down. Unmounting on `open` would drop the slide-out and the
   * drawer would vanish instead of sliding away.
   */
  const [mounted, setMounted] = useState(false);

  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  const poll = useCallback(async () => {
    if (!hasSession() && !loading) {
      return;
    }
    try {
      const bell = await fetchFollowupsBell();
      setCount(bell.count);
      setFollowups(bell.followups);
    } catch {
      // Keep the last known count rather than flashing it away.
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useFocusEffect(
    useCallback(() => {
      void poll();
    }, [poll]),
  );

  useEffect(() => {
    const id = setInterval(() => {
      void poll();
    }, REFRESH_INTERVAL_MS);
    // Keeps the handle from holding the test runner open. React Native types
    // this as a plain number, so the guard is what makes it safe to call.
    (id as { unref?: () => void }).unref?.();
    interval.current = id;

    return () => {
      if (interval.current) {
        clearInterval(interval.current);
        interval.current = null;
      }
    };
  }, [poll]);

  const openDrawer = useCallback(() => {
    setOpen(true);
    // Read on open rather than trusting the polled copy — the bell's badge
    // may be a minute stale by the time the drawer is actually looked at.
    void poll();
  }, [poll]);

  const closeDrawer = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          setMounted(false);
        }
      });
    }
  }, [open, progress]);

  const openLead = (followUp: FollowUp) => {
    setOpen(false);
    if (!followUp.leadId) {
      return;
    }
    navigation.navigate('LeadDetail', {
      leadId: followUp.leadId,
      investor: followUp.investor,
      phone: followUp.phone,
      company: followUp.company,
    });
  };

  const goToFollowUps = () => {
    setOpen(false);
    navigation.navigate('FollowUps');
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 8 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dx > 0) {
            progress.setValue(
              Math.min(1, 1 + (gesture.dx / panelWidth) * SLIDE_FRICTION),
            );
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > panelWidth * 0.25 || gesture.vx > 0.5) {
            closeDrawer();
            return;
          }
          Animated.timing(progress, {
            toValue: 1,
            duration: 200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start();
        },
      }),
    [closeDrawer, panelWidth, progress],
  );

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [panelWidth, 0],
  });

  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.45],
  });

  const ordered = useMemo(
    () => [...followups].sort(byUrgency),
    [followups],
  );

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={openDrawer}
        className="w-10 h-10 rounded-full border border-neutral-200 bg-white items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel={
          count > 0
            ? `Follow-up notifications, ${count} pending`
            : 'Follow-up notifications'
        }>
        <Bell size={18} color="#3F465C" />

        {count > 0 && (
          <View
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-secondary-600 items-center justify-center"
            style={{ borderWidth: 1.5, borderColor: '#FAF8FF' }}>
            <Text className="font-lato-bold text-[9px] text-white">
              {count > 99 ? '99+' : count}
            </Text>
          </View>
        )}

        {loading && (
          <View className="absolute bottom-0.5 right-0.5">
            <ActivityIndicator size="small" color="#5279AC" />
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={mounted}
        transparent
        animationType="none"
        onRequestClose={closeDrawer}
        statusBarTranslucent>
        <View style={styles.root}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeDrawer}
              accessibilityRole="button"
              accessibilityLabel="Close notifications"
            />
          </Animated.View>

          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.panel,
              { width: panelWidth, transform: [{ translateX }] },
            ]}>
            {/* ----------------------------- Header ---------------------------- */}
            <View
              className="bg-primary-900 overflow-hidden px-5"
              style={{ paddingTop: insets.top + 18, paddingBottom: 20 }}>
              <View
                pointerEvents="none"
                className="absolute bg-primary-400 opacity-20 rounded-full"
                style={{ width: 190, height: 190, top: -90, right: -60 }}
              />

              <View className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Text className="font-lato-black text-lg text-white">
                    Notifications
                  </Text>
                  <Text className="font-lato text-xs text-primary-300 mt-1">
                    {count === 0
                      ? 'Nothing outstanding'
                      : `${count} pending follow-up${count === 1 ? '' : 's'}`}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={closeDrawer}
                  className="w-9 h-9 rounded-full items-center justify-center"
                  style={{ backgroundColor: 'rgba(255,255,255,0.16)' }}
                  accessibilityRole="button"
                  accessibilityLabel="Close notifications">
                  <X size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* ------------------------------ List ----------------------------- */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 16, paddingBottom: 20 }}>
              {ordered.length === 0 ? (
                <View className="items-center py-10">
                  <View className="w-14 h-14 rounded-full bg-primary-200 items-center justify-center mb-3">
                    <Bell size={22} color="#5279AC" />
                  </View>
                  <Text className="font-lato-bold text-sm text-neutral-900 text-center">
                    You&apos;re all caught up
                  </Text>
                  <Text className="font-lato text-xs text-neutral-600 text-center mt-1.5 leading-5">
                    Nothing is waiting on you right now.
                  </Text>
                </View>
              ) : (
                ordered.map((followUp, index) => (
                  <FollowUpCard
                    key={followUp.id || index}
                    followUp={followUp}
                    onPress={openLead}
                    showComment
                  />
                ))
              )}
            </ScrollView>

            {/* ----------------------------- Footer ---------------------------- */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={goToFollowUps}
              className="flex-row items-center justify-center gap-1.5 border-t border-neutral-200 py-4"
              accessibilityRole="button"
              accessibilityLabel="View all follow-ups">
              <Text className="font-lato-bold text-sm text-primary-700">
                View all follow-ups
              </Text>
              <ChevronRight size={15} color="#5279AC" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
