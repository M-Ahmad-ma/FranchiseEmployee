import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, X } from 'lucide-react-native';
import {
  fetchFollowupsBell,
  type FollowUp,
} from '../services/followupsService';
import { toApiDate } from '../services/utils';
import { hasSession } from '../services/httpClient';
import type { RootStackParamList } from '../navigation/types';

const REFRESH_INTERVAL_MS = 60_000;

/**
 * Header bell for `GET /api/team/followups/bell`.
 *
 * The badge refreshes when the screen gains focus and then on a slow interval,
 * so a scheduled follow-up shows up without the user hunting for the screen.
 * A failed poll is swallowed — the badge is ambient information, and a network
 * blip should not surface an error over whatever the screen is doing.
 */
export function FollowUpsBell() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [count, setCount] = useState(0);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const when = (followUp: FollowUp) => {
    const iso = toApiDate(followUp.date);
    const parts = iso
      ? iso.split('-').reverse().join('/')
      : followUp.date;
    return [parts, followUp.time].filter(Boolean).join(' · ');
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          void poll();
          setOpen(true);
        }}
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
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent>
        <View className="flex-1 bg-black/30 justify-center px-6">
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setOpen(false)}
            accessibilityLabel="Close notifications"
          />

          <View className="bg-white rounded-3xl max-h-[80%]">
            <View className="flex-row items-center justify-between px-4 pt-4 pb-3">
              <View className="flex-1">
                <Text className="font-lato-black text-base text-neutral-900">
                  Follow-ups
                </Text>
                <Text className="font-lato text-xs text-neutral-600 mt-0.5">
                  {count === 0
                    ? 'Nothing outstanding'
                    : `${count} pending follow-up${count === 1 ? '' : 's'}`}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setOpen(false)}
                className="w-9 h-9 rounded-full bg-neutral-200 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Close">
                <X size={16} color="#6F778E" />
              </TouchableOpacity>
            </View>

            {followups.length === 0 ? (
              <View className="items-center px-6 pb-8 pt-2">
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
              <ScrollView showsVerticalScrollIndicator={false}>
                {followups.map((followUp, index) => (
                  <TouchableOpacity
                    key={followUp.id || index}
                    activeOpacity={0.8}
                    onPress={() => openLead(followUp)}
                    className="px-4 py-3.5"
                    style={
                      index > 0
                        ? { borderTopWidth: 1, borderTopColor: '#EEF0FF' }
                        : undefined
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Follow up with ${followUp.investor || 'lead'} on ${when(followUp)}`}>
                    <View className="flex-row items-center gap-3">
                      <View className="w-8 h-8 rounded-full bg-tertiary-200 items-center justify-center">
                        <Bell size={14} color="#0081A7" />
                      </View>

                      <View className="flex-1">
                        <Text
                          className="font-lato-bold text-sm text-neutral-900"
                          numberOfLines={1}>
                          {followUp.investor || 'Unnamed lead'}
                        </Text>
                        <Text
                          className="font-lato text-xs text-neutral-700 mt-0.5"
                          numberOfLines={1}>
                          {[followUp.company, followUp.city]
                            .filter(Boolean)
                            .join(' · ') || 'No company on file'}
                        </Text>
                        {followUp.comment ? (
                          <Text
                            className="font-lato text-xs text-neutral-600 mt-1"
                            numberOfLines={2}>
                            {followUp.comment}
                          </Text>
                        ) : null}
                      </View>

                      <View className="items-end">
                        <View className="rounded-full bg-primary-200 px-2.5 py-1">
                          <Text className="font-lato-bold text-[10px] text-primary-700">
                            {when(followUp) || 'No date'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setOpen(false);
                navigation.navigate('FollowUps');
              }}
              className="items-center border-t border-neutral-200 py-3.5"
              accessibilityRole="button">
              <Text className="font-lato-bold text-sm text-primary-700">
                View all follow-ups
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}