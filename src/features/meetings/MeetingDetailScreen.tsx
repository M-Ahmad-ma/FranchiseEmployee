import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Building2, CalendarClock, MapPin } from 'lucide-react-native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { AlertBanner } from '../../shared/components/AlertBanner';
import { Card } from '../../shared/components/Card';
import {
  fetchMeetingDetail,
  type Meeting,
} from '../../services/meetingService';
import { describeApiError } from '../../services/httpClient';
import type { RootStackParamList } from '../../navigation/types';

export function MeetingDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'MeetingDetail'>>();
  const { meetingId } = route.params;
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMeeting(await fetchMeetingDetail(meetingId));
    } catch (loadError) {
      setMeeting(null);
      setError(describeApiError(loadError, 'Could not load this meeting.'));
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const when = [meeting?.date, meeting?.time].filter(Boolean).join(' · ');

  return (
    <DashboardLayout
      title={meeting?.title || meeting?.brand || 'Meeting'}
      subtitle="Meeting detail"
      showGoBack
      showBell={false}
      onRefresh={load}
      refreshing={loading}>
      {error ? (
        <View className="mb-4">
          <AlertBanner message={error} />
        </View>
      ) : null}

      {loading && !meeting ? (
        <View className="items-center py-10">
          <ActivityIndicator size="large" color="#5279AC" />
        </View>
      ) : null}

      {meeting ? (
        <>
          <Card className="bg-white rounded-2xl p-4">
            <View className="flex-row items-center gap-3 mb-3">
              <View className="w-10 h-10 rounded-xl bg-primary-200 items-center justify-center">
                <CalendarClock size={18} color="#5279AC" />
              </View>
              <View className="flex-1">
                <Text className="font-lato-bold text-base text-neutral-900">
                  {when || 'No date'}
                </Text>
                {meeting.type ? (
                  <Text className="font-lato text-xs text-neutral-600 mt-0.5">
                    {meeting.type}
                  </Text>
                ) : null}
              </View>
            </View>

            {meeting.brand ? (
              <View className="flex-row items-center gap-2 py-2 border-t border-neutral-200">
                <Building2 size={15} color="#5279AC" />
                <Text className="font-lato text-sm text-neutral-900 flex-1">
                  {meeting.brand}
                </Text>
              </View>
            ) : null}

            {meeting.venue ? (
              <View className="flex-row items-center gap-2 py-2 border-t border-neutral-200">
                <MapPin size={15} color="#5279AC" />
                <Text className="font-lato text-sm text-neutral-900 flex-1">
                  {meeting.venue}
                </Text>
              </View>
            ) : null}

            {meeting.description ? (
              <View className="pt-3 border-t border-neutral-200">
                <Text className="font-lato-bold text-xs text-neutral-600 mb-1">
                  Description
                </Text>
                <Text className="font-lato text-sm text-neutral-900 leading-5">
                  {meeting.description}
                </Text>
              </View>
            ) : null}
          </Card>
        </>
      ) : null}

      {!loading && !meeting && !error ? (
        <AlertBanner message="Meeting not found." />
      ) : null}
    </DashboardLayout>
  );
}
