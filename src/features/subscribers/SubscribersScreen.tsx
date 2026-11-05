import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  CalendarDays,
  Mail,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { AlertBanner } from '../../shared/components/AlertBanner';
import { Badge } from '../../shared/components/Badge';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { DetailRow, DetailSection } from '../../shared/components/RecordDetails';
import { TextField } from '../../shared/components/TextField';
import {
  fetchSubscribers,
  type ModuleRow,
} from '../../services/moduleService';
import { describeApiError } from '../../services/httpClient';
import { pickString } from '../../services/utils';

interface SubscriberRecord {
  id: string;
  email: string;
  status: string;
  subscribedAt: string;
  raw: Record<string, unknown>;
}

function normalizeSubscriber(row: ModuleRow): SubscriberRecord {
  const raw = row.raw;
  return {
    id: row.id || pickString(raw, ['s_id', 'sub_id', 'subscriber_id', 'id']),
    email:
      pickString(raw, ['s_email', 'email', 'sub_email', 'u_email']) ||
      row.title,
    status: pickString(raw, ['s_status', 'status', 'sub_status']),
    subscribedAt: pickString(raw, [
      's_time_date',
      'created',
      'created_at',
      'sub_date',
    ]),
    raw,
  };
}

function statusLabel(status: string): string {
  if (status === '1') {
    return 'Subscribed';
  }
  if (status === '0') {
    return 'Unsubscribed';
  }
  return status || 'Unknown';
}

function formatSubscribedAt(value: string): string {
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    return value || '—';
  }
  const [, year, month, day, hour, minute] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function subscriberInitials(email: string): string {
  const source = email.split('@')[0] || '';
  return (
    source
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('') || 'S'
  );
}

export function SubscribersScreen() {
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SubscriberRecord | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchSubscribers(force));
      setVisibleCount(20);
    } catch (loadError) {
      setRows([]);
      setError(describeApiError(loadError, 'Could not load subscribers.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await load(true);
    } finally {
      setPullRefreshing(false);
    }
  }, [load]);

  const subscribers = useMemo(() => rows.map(normalizeSubscriber), [rows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return subscribers;
    }
    return subscribers.filter(subscriber =>
      [
        subscriber.email,
        statusLabel(subscriber.status),
        subscriber.subscribedAt,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [query, subscribers]);

  return (
    <DashboardLayout
      title="Subscribers"
      subtitle="Newsletter subscribers"
      showMenu
      onRefresh={refresh}
      refreshing={pullRefreshing}>
      <Card className="bg-white rounded-2xl p-4 mb-4">
        <TextField
          label="Search subscribers"
          placeholder="Email, status or date"
          value={query}
          onChangeText={value => {
            setQuery(value);
            setVisibleCount(20);
          }}
        />
        <Badge
          label={`${filtered.length} of ${subscribers.length} subscriber${
            subscribers.length === 1 ? '' : 's'
          }`}
        />
      </Card>

      {error ? (
        <View className="mb-4">
          <AlertBanner message={error} />
        </View>
      ) : null}

      {loading && rows.length === 0 ? (
        <View className="items-center py-10">
          <ActivityIndicator size="large" color="#5279AC" />
        </View>
      ) : filtered.length === 0 ? (
        <AlertBanner
          message={
            subscribers.length === 0
              ? 'No subscribers found.'
              : 'No subscribers match that search.'
          }
        />
      ) : (
        <View style={{ opacity: loading ? 0.55 : 1 }}>
          {filtered.slice(0, visibleCount).map((subscriber, index) => (
            <Card
              key={`${subscriber.id || subscriber.email || 'subscriber'}-${index}`}
              className="bg-white rounded-2xl p-4 mb-3">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSelected(subscriber)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${subscriber.email}`}>
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-full bg-primary-200 items-center justify-center">
                    <Text className="font-lato-black text-xs text-primary-800">
                      {subscriberInitials(subscriber.email)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text
                      className="font-lato-bold text-base text-neutral-900"
                      numberOfLines={1}>
                      {subscriber.email || 'No email'}
                    </Text>
                    <Text className="font-lato text-xs text-neutral-600 mt-1">
                      Newsletter subscriber
                    </Text>
                  </View>
                  <Badge
                    label={statusLabel(subscriber.status)}
                    tone={subscriber.status === '1' ? 'success' : 'neutral'}
                  />
                </View>

                <View className="flex-row flex-wrap gap-2 mt-3">
                  <View className="flex-row items-center gap-1 bg-neutral-200 rounded-full px-2.5 py-1">
                    <CalendarDays size={11} color="#565E74" />
                    <Text className="font-lato text-[11px] text-neutral-700">
                      {formatSubscribedAt(subscriber.subscribedAt)}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1 bg-neutral-200 rounded-full px-2.5 py-1">
                    <ShieldCheck size={11} color="#565E74" />
                    <Text className="font-lato text-[11px] text-neutral-700">
                      Subscriber #{subscriber.id || '—'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <View className="flex-row justify-end mt-3 pt-3 border-t border-neutral-200">
                <Button
                  title="View details"
                  size="sm"
                  variant="secondary"
                  onPress={() => setSelected(subscriber)}
                />
              </View>
            </Card>
          ))}
        </View>
      )}

      {filtered.length > visibleCount ? (
        <Button
          title={`Show ${Math.min(20, filtered.length - visibleCount)} more`}
          size="lg"
          variant="outlined"
          className="mb-3"
          onPress={() => setVisibleCount(current => current + 20)}
        />
      ) : null}

      {selected ? (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setSelected(null)}>
          <View className="flex-1 bg-black/40 justify-end">
            <View className="bg-white rounded-t-3xl max-h-[88%] px-5 pt-5 pb-6">
              <View className="flex-row items-center justify-between gap-3 mb-4">
                <View className="flex-row items-center gap-3 flex-1">
                  <View className="w-12 h-12 rounded-full bg-primary-200 items-center justify-center">
                    <Mail size={20} color="#5279AC" />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="font-lato-black text-lg text-neutral-900"
                      numberOfLines={1}>
                      {selected.email || 'Subscriber'}
                    </Text>
                    <Text className="font-lato text-xs text-neutral-600 mt-0.5">
                      Subscriber #{selected.id || '—'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setSelected(null)}
                  className="w-9 h-9 rounded-full bg-neutral-200 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Close subscriber details">
                  <X size={16} color="#6F778E" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  <Badge
                    label={statusLabel(selected.status)}
                    tone={selected.status === '1' ? 'success' : 'neutral'}
                  />
                </View>

                <DetailSection title="Subscriber">
                  <DetailRow
                    icon={<Mail size={15} color="#5279AC" />}
                    label="Email"
                    value={selected.email || '—'}
                  />
                  <DetailRow
                    icon={<ShieldCheck size={15} color="#5279AC" />}
                    label="Status"
                    value={statusLabel(selected.status)}
                  />
                  <DetailRow
                    icon={<CalendarDays size={15} color="#5279AC" />}
                    label="Subscribed"
                    value={formatSubscribedAt(selected.subscribedAt)}
                  />
                  <DetailRow
                    icon={<Mail size={15} color="#5279AC" />}
                    label="ID"
                    value={selected.id || '—'}
                  />
                </DetailSection>

                {selected.email ? (
                  <Button
                    title="Send email"
                    size="lg"
                    icon={<Send size={16} color="#FFFFFF" />}
                    onPress={() => {
                      void Linking.openURL(`mailto:${selected.email}`);
                    }}
                  />
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </DashboardLayout>
  );
}
