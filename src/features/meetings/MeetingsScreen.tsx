import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Building2, CalendarClock, ChevronRight, Plus } from 'lucide-react-native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { AlertBanner } from '../../shared/components/AlertBanner';
import { Badge } from '../../shared/components/Badge';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { TabGroup, type TabItem } from '../../shared/components/TabGroup';
import { MeetingSheet } from './MeetingSheet';
import { useAuth } from '../../navigation/AuthContext';
import { P } from '../../services/permissions';
import {
  fetchBrandMeetings,
  fetchMeetings,
  type Meeting,
} from '../../services/meetingService';
import { describeApiError } from '../../services/httpClient';
import { clearMeetingsCache } from '../../services/meetingService';
import type { RootStackParamList } from '../../navigation/types';

type MeetingTab = 'active' | 'closed' | 'brand';

export function MeetingsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { can } = useAuth();
  const canMyMeetings = can(P.meetingsView);
  const canBrandMeetings = can(P.brandsView);
  const canCreate = can(P.brandsAdd);

  const tabs = useMemo(() => {
    const next: TabItem[] = [];
    if (canMyMeetings) {
      next.push({ key: 'active', label: 'Upcoming' });
      next.push({ key: 'closed', label: 'Past' });
    }
    if (canBrandMeetings) {
      next.push({ key: 'brand', label: 'Brand' });
    }
    return next;
  }, [canBrandMeetings, canMyMeetings]);

  const [tab, setTab] = useState<MeetingTab>(
    canMyMeetings ? 'active' : 'brand',
  );
  const [rows, setRows] = useState<Meeting[]>([]);
  const [visibleCount, setVisibleCount] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!tabs.some(item => item.key === tab) && tabs[0]) {
      setTab(tabs[0].key as MeetingTab);
    }
  }, [tab, tabs]);

  const load = useCallback(async () => {
    if (tab !== 'brand' && !canMyMeetings) {
      setRows([]);
      setLoading(false);
      return;
    }
    if (tab === 'brand' && !canBrandMeetings) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next =
        tab === 'brand'
          ? await fetchBrandMeetings()
          : await fetchMeetings(tab === 'active' ? '1' : '0');
      setRows(next);
      setVisibleCount(20);
    } catch (loadError) {
      setRows([]);
      setError(describeApiError(loadError, 'Could not load meetings.'));
    } finally {
      setLoading(false);
    }
  }, [canBrandMeetings, canMyMeetings, tab]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await load();
    } finally {
      setPullRefreshing(false);
    }
  }, [load]);

  const openMeeting = (meeting: Meeting) => {
    if (!canMyMeetings || !meeting.id) {
      return;
    }
    navigation.navigate('MeetingDetail', { meetingId: meeting.id });
  };

  return (
    <DashboardLayout
      title="Meetings"
      subtitle="Team and brand meetings"
      showMenu
      onRefresh={refresh}
      refreshing={pullRefreshing}>
      {tabs.length > 1 ? (
        <TabGroup tabs={tabs} value={tab} onChange={key => setTab(key as MeetingTab)} />
      ) : null}

      <View className="flex-row items-center justify-between gap-3 mb-3">
        <Badge
          label={`${rows.length} meeting${rows.length === 1 ? '' : 's'}`}
        />
        {canCreate ? (
          <Button
            title="Log meeting"
            size="sm"
            icon={<Plus size={14} color="#FFFFFF" />}
            onPress={() => setCreateOpen(true)}
          />
        ) : null}
      </View>

      {error ? (
        <View className="mb-4">
          <AlertBanner message={error} />
        </View>
      ) : null}

      {loading && rows.length === 0 ? (
        <View className="items-center py-10">
          <ActivityIndicator size="large" color="#5279AC" />
        </View>
      ) : rows.length === 0 ? (
        <Card className="bg-white rounded-2xl">
          <View className="items-center px-6 py-8">
            <View className="w-14 h-14 rounded-full bg-primary-200 items-center justify-center mb-3">
              <CalendarClock size={24} color="#5279AC" />
            </View>
            <Text className="font-lato-bold text-base text-neutral-900">
              No meetings
            </Text>
            <Text className="font-lato text-xs text-neutral-600 text-center mt-1.5">
              Nothing is scheduled in this list.
            </Text>
          </View>
        </Card>
      ) : (
        <View style={{ opacity: loading ? 0.55 : 1 }}>
          {rows.slice(0, visibleCount).map((meeting, index) => {
            const when = [meeting.date, meeting.time].filter(Boolean).join(' · ');
            return (
              <TouchableOpacity
                key={meeting.id || index}
                activeOpacity={canMyMeetings ? 0.85 : 1}
                onPress={() => openMeeting(meeting)}
                disabled={!canMyMeetings}
                accessibilityRole={canMyMeetings ? 'button' : undefined}>
                <Card className="bg-white rounded-2xl p-4 mb-3">
                  <View className="flex-row items-center gap-3">
                    <View className="w-9 h-9 rounded-xl bg-primary-200 items-center justify-center">
                      <CalendarClock size={17} color="#5279AC" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-lato-bold text-sm text-neutral-900">
                        {meeting.title || meeting.brand || 'Meeting'}
                      </Text>
                      <Text className="font-lato text-[11px] text-neutral-600 mt-0.5">
                        {when || 'No date'}
                      </Text>
                    </View>
                    {canMyMeetings && meeting.id ? (
                      <ChevronRight size={15} color="#A3ABC4" />
                    ) : null}
                  </View>

                  {meeting.venue || meeting.brand ? (
                    <View className="flex-row items-center gap-1.5 mt-3">
                      <Building2 size={13} color="#8990A8" />
                      <Text className="font-lato text-xs text-neutral-700 flex-1">
                        {[meeting.brand, meeting.venue].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  ) : null}

                  {meeting.description ? (
                    <Text className="font-lato text-xs text-neutral-600 mt-2 leading-5">
                      {meeting.description}
                    </Text>
                  ) : null}
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {rows.length > visibleCount ? (
        <Button
          title={`Show ${Math.min(20, rows.length - visibleCount)} more`}
          size="lg"
          variant="outlined"
          className="mb-3"
          onPress={() => setVisibleCount(current => current + 20)}
        />
      ) : null}

      {canCreate ? (
        <MeetingSheet
          visible={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            clearMeetingsCache();
            await load();
          }}
        />
      ) : null}
    </DashboardLayout>
  );
}
