import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  CalendarClock,
  ChevronRight,
  Filter,
  Images,
  Inbox,
  RefreshCw,
} from 'lucide-react-native';
import type { RootStackParamList } from '../../navigation/types';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Card, cardShadow } from '../../shared/components/Card';
import {
  fetchFollowUps,
  type FollowUpRow,
} from '../../services/followUpsService';
import {
  fetchRequests,
  type LeadRequestRow,
} from '../../services/requestsService';
import { COMPANY_OPTIONS } from '../../services/options';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const heroShadow: StyleProp<ViewStyle> = {
  shadowColor: '#001C39',
  shadowOpacity: 0.28,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 6,
};

const s = StyleSheet.create({
  /** Decorative geometry behind the hero copy — never interactive. */
  heroDecor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  heroBlobTop: {
    position: 'absolute',
    width: 230,
    height: 230,
    top: -120,
    right: -80,
  },
  heroBlobBottom: {
    position: 'absolute',
    width: 250,
    height: 250,
    bottom: -160,
    left: -70,
  },
  avatar: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  heroRule: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.16)',
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#EEF0FF',
  },
});

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
};

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
};

function greetingFor(date: Date) {
  const hour = date.getHours();
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

const statusClass: Record<FollowUpRow['status'], string> = {
  Due: 'bg-secondary-200 text-secondary-700',
  Overdue: 'bg-neutral-200 text-red-500',
  Upcoming: 'bg-primary-200 text-primary-700',
  Done: 'bg-[#BEFFDB] text-[#00A572]',
};

/* -------------------------------------------------------------------------- */
/*  Static navigation launcher                                                 */
/* -------------------------------------------------------------------------- */

interface Shortcut {
  screen: keyof Omit<RootStackParamList, 'Home'>;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  disc: string;
}

const SHORTCUTS: Shortcut[] = [
  {
    screen: 'Requests',
    title: 'Lead Requests',
    subtitle: 'Filter leads by criteria',
    icon: <Filter size={18} color="#5279AC" />,
    disc: 'bg-primary-200',
  },
  {
    screen: 'FollowUps',
    title: 'Follow-ups',
    subtitle: 'Due, overdue & upcoming',
    icon: <CalendarClock size={18} color="#0081A7" />,
    disc: 'bg-tertiary-200',
  },
  {
    screen: 'CompanyMedia',
    title: 'Company Media',
    subtitle: 'Images, videos & PDFs',
    icon: <Images size={18} color="#BC5D00" />,
    disc: 'bg-secondary-200',
  },
];

/* -------------------------------------------------------------------------- */
/*  Screen                                                                     */
/* -------------------------------------------------------------------------- */

export function HomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const now = new Date();

  const [followUps, setFollowUps] = useState<FollowUpRow[]>([]);
  const [requests, setRequests] = useState<LeadRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dueRows, requestRows] = await Promise.all([
        fetchFollowUps('active'),
        fetchRequests({}),
      ]);
      setFollowUps(dueRows);
      setRequests(requestRows);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const preview = followUps.slice(0, 3);

  const metrics: { label: string; value: number | null; dot: string }[] = [
    { label: 'Due', value: followUps.length, dot: 'bg-secondary-500' },
    { label: 'Requests', value: requests.length, dot: 'bg-primary-700' },
    {
      label: 'Companies',
      value: COMPANY_OPTIONS.length,
      dot: 'bg-tertiary-600',
    },
  ];

  return (
    <DashboardLayout
      title="Home"
      subtitle="Your franchise workspace at a glance"
      showBack={false}
      showMenu>
      {/* ------------------------------ Hero ------------------------------ */}
      <Card
        className="bg-primary-900 rounded-3xl overflow-hidden mb-5"
        style={heroShadow}>
        {/* decorative depth layers */}
        <View style={s.heroDecor}>
          <View
            className="bg-primary-400 opacity-20 rounded-full"
            style={s.heroBlobTop}
          />
          <View
            className="bg-primary-dark-2 opacity-60 rounded-full"
            style={s.heroBlobBottom}
          />
        </View>

        <View className="p-5">
          <View className="flex-row items-center justify-end">
            <View
              className="w-11 h-11 rounded-full items-center justify-center"
              style={s.avatar}>
              <Text className="font-lato-black text-sm text-white">FE</Text>
            </View>
          </View>

          <Text className="font-lato-black text-3xl text-white mt-5">
            {greetingFor(now)}
          </Text>
          <Text className="font-lato text-sm text-primary-300 mt-1">
            Franchise Employee
          </Text>

          <View className="flex-row items-center mt-5 pt-4" style={s.heroRule}>
            <Text className="font-lato text-xs text-primary-200">
              {now.toLocaleDateString('en-US', DATE_FORMAT)}
            </Text>
            <View className="w-1 h-1 rounded-full bg-primary-400 mx-2.5" />
            <Text className="font-lato-bold text-xs text-white">
              {now.toLocaleTimeString('en-US', TIME_FORMAT)}
            </Text>
          </View>
        </View>
      </Card>

      {/* --------------------------- At a glance -------------------------- */}
      <View className="flex-row items-center justify-between mb-3 px-1">
        <Text className="font-lato-black text-lg text-neutral-900">
          At a glance
        </Text>
        {loading && <ActivityIndicator size="small" color="#5279AC" />}
      </View>

      <Card className="bg-white rounded-2xl flex-row py-4 mb-6">
        {metrics.map((metric, index) => (
          <View key={metric.label} className="flex-1 flex-row">
            <View className="flex-1 items-center px-1">
              <View className={`w-1.5 h-1.5 rounded-full ${metric.dot} mb-2`} />
              <Text className="font-lato-black text-2xl text-neutral-900">
                {metric.value === null || loading ? '—' : String(metric.value)}
              </Text>
              <Text className="font-lato-bold text-[10px] uppercase tracking-[1px] text-neutral-600 mt-1 text-center">
                {metric.label}
              </Text>
            </View>
            {index < metrics.length - 1 && (
              <View className="w-px bg-neutral-200" />
            )}
          </View>
        ))}
      </Card>

      <Text className="font-lato-black text-lg text-neutral-900 mb-3 px-1">
        Go to
      </Text>

      <View className="flex-row flex-wrap justify-between mb-6">
        {SHORTCUTS.map(shortcut => (
          <TouchableOpacity
            key={shortcut.screen}
            activeOpacity={0.8}
            onPress={() => navigation.navigate(shortcut.screen)}
            className="w-[48%] bg-white rounded-2xl p-3 mb-3 min-h-[132px]"
            style={cardShadow}
            accessibilityRole="button"
            accessibilityLabel={`${shortcut.title}. ${shortcut.subtitle}`}>
            <View
              className={`w-9 h-9 rounded-xl ${shortcut.disc} items-center justify-center mb-3`}>
              {shortcut.icon}
            </View>
            <Text className="font-lato-bold text-[13px] text-neutral-900 leading-4">
              {shortcut.title}
            </Text>
            <Text className="font-lato text-[11px] text-neutral-600 leading-4 mt-1">
              {shortcut.subtitle}
            </Text>
            <View className="flex-1" />
            <View className="self-end">
              <ChevronRight size={14} color="#A3ABC4" />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View className="flex-row items-center justify-between mb-3 px-1">
        <Text className="font-lato-black text-lg text-neutral-900">
          Needs your attention
        </Text>
        {preview.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('FollowUps')}
            className="flex-row items-center gap-0.5"
            accessibilityRole="button"
            accessibilityLabel="View all follow-ups">
            <Text className="font-lato-bold text-xs text-primary-700">
              View all
            </Text>
            <ChevronRight size={14} color="#5279AC" />
          </TouchableOpacity>
        )}
      </View>

      <Card className="bg-white rounded-2xl overflow-hidden">
        {error ? (
          <View className="items-center px-6 py-8">
            <Text className="text-red-500 text-sm font-lato text-center">
              {error}
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={load}
              className="flex-row items-center gap-1.5 mt-3 rounded-full bg-primary-200 px-4 py-2"
              accessibilityRole="button"
              accessibilityLabel="Retry loading overview">
              <RefreshCw size={14} color="#5279AC" />
              <Text className="font-lato-bold text-xs text-primary-700">
                Try again
              </Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="#5279AC" />
          </View>
        ) : preview.length === 0 ? (
          <View className="items-center px-6 py-8">
            <View className="w-14 h-14 rounded-full bg-primary-200 items-center justify-center mb-3">
              <Inbox size={24} color="#5279AC" />
            </View>
            <Text className="font-lato-bold text-base text-neutral-900">
              You&apos;re all caught up
            </Text>
            <Text className="font-lato text-xs text-neutral-600 text-center mt-1.5 leading-5">
              No follow-ups are due or overdue right now. Anything that needs
              you will land here first.
            </Text>
          </View>
        ) : (
          preview.map((row, index) => (
            <TouchableOpacity
              key={row.id}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('FollowUps')}
              className="px-4 py-3.5 flex-row items-center gap-3"
              style={index > 0 ? s.rowDivider : undefined}
              accessibilityRole="button"
              accessibilityLabel={`Follow up with ${row.lead}, ${row.status}`}>
              <View className="items-center w-12">
                <Text className="font-lato-black text-sm text-neutral-900">
                  {row.time}
                </Text>
                <Text className="font-lato text-[10px] uppercase tracking-[1px] text-neutral-500 mt-0.5">
                  {row.date}
                </Text>
              </View>

              <View className="w-px self-stretch bg-neutral-200" />

              <View className="flex-1">
                <Text
                  className="font-lato-bold text-sm text-neutral-900"
                  numberOfLines={1}>
                  {row.lead}
                </Text>
                <Text
                  className="font-lato text-xs text-neutral-700 mt-0.5"
                  numberOfLines={1}>
                  {row.comment || row.phone}
                </Text>
              </View>

              <View
                className={`rounded-full px-3 py-1 ${statusClass[row.status]}`}>
                <Text className="font-lato-bold text-[11px]">{row.status}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </Card>
    </DashboardLayout>
  );
}
