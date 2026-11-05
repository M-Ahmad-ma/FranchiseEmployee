import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CalendarDays,
  MapPin,
  Search,
  Store,
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
  fetchShows,
  type ModuleRow,
} from '../../services/moduleService';
import { describeApiError } from '../../services/httpClient';
import { pickString } from '../../services/utils';

interface ShowRecord {
  id: string;
  title: string;
  venue: string;
  city: string;
  date: string;
  time: string;
  description: string;
  status: string;
  raw: Record<string, unknown>;
}

function normalizeShow(row: ModuleRow): ShowRecord {
  const raw = row.raw;
  return {
    id: row.id || pickString(raw, ['show_id', 's_id', 'id']),
    title:
      pickString(raw, ['title', 'show_name', 'name', 'brand_name']) ||
      row.title,
    venue: pickString(raw, ['venue', 'show_venue', 'location']),
    city: pickString(raw, ['city_name', 'city']),
    date: pickString(raw, ['date', 'show_date', 'start_date']),
    time: pickString(raw, ['time', 'show_time', 'start_time']),
    description: pickString(raw, ['description', 'show_description', 'desc']),
    status: pickString(raw, ['status', 'show_status']),
    raw,
  };
}

function statusLabel(status: string): string {
  if (status === '1') {
    return 'Active';
  }
  if (status === '0') {
    return 'Inactive';
  }
  return status || '';
}

function showInitials(title: string): string {
  return (
    title
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('') || 'S'
  );
}

export function ShowsScreen() {
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [city, setCity] = useState('');
  const [appliedCity, setAppliedCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ShowRecord | null>(null);

  const load = useCallback(async (targetCity: string, force = false) => {
    if (!targetCity.trim()) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchShows(targetCity.trim(), force));
      setVisibleCount(20);
    } catch (loadError) {
      setRows([]);
      setError(describeApiError(loadError, 'Could not load shows.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const applyCity = () => {
    const trimmed = city.trim();
    setAppliedCity(trimmed);
    void load(trimmed, true);
  };

  const refresh = useCallback(async () => {
    if (!appliedCity) {
      return;
    }
    setPullRefreshing(true);
    try {
      await load(appliedCity, true);
    } finally {
      setPullRefreshing(false);
    }
  }, [appliedCity, load]);

  const shows = useMemo(() => rows.map(normalizeShow), [rows]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return shows;
    }
    return shows.filter(show =>
      [show.title, show.venue, show.city, show.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [query, shows]);

  return (
    <DashboardLayout
      title="Shows"
      subtitle="Shows filtered by city"
      showMenu
      onRefresh={refresh}
      refreshing={pullRefreshing}>
      <Card className="bg-white rounded-2xl p-4 mb-4">
        <TextField
          label="City"
          placeholder="Enter a city name"
          value={city}
          onChangeText={setCity}
          autoCapitalize="words"
        />
        <Button
          title="Load shows"
          size="lg"
          loading={loading}
          icon={<Search size={16} color="#FFFFFF" />}
          onPress={applyCity}
        />
      </Card>

      {appliedCity ? (
        <Card className="bg-white rounded-2xl p-4 mb-4">
          <TextField
            label="Search results"
            placeholder="Show name, venue or description"
            value={query}
            onChangeText={value => {
              setQuery(value);
              setVisibleCount(20);
            }}
          />
          <Badge
            label={`${filtered.length} show${
              filtered.length === 1 ? '' : 's'
            } in ${appliedCity}`}
          />
        </Card>
      ) : null}

      {error ? (
        <View className="mb-4">
          <AlertBanner message={error} />
        </View>
      ) : null}

      {!appliedCity ? (
        <Card className="bg-white rounded-2xl">
          <View className="items-center px-6 py-8">
            <View className="w-14 h-14 rounded-full bg-primary-200 items-center justify-center mb-3">
              <Store size={24} color="#5279AC" />
            </View>
            <Text className="font-lato-bold text-base text-neutral-900">
              Choose a city
            </Text>
            <Text className="font-lato text-xs text-neutral-600 text-center mt-1.5 leading-5">
              Enter a city above to load its shows.
            </Text>
          </View>
        </Card>
      ) : loading && rows.length === 0 ? (
        <View className="items-center py-10">
          <ActivityIndicator size="large" color="#5279AC" />
        </View>
      ) : filtered.length === 0 ? (
        <AlertBanner
          message={
            shows.length === 0
              ? `No shows found in ${appliedCity}.`
              : 'No shows match that search.'
          }
        />
      ) : (
        <View style={{ opacity: loading ? 0.55 : 1 }}>
          {filtered.slice(0, visibleCount).map(show => (
            <Card
              key={show.id || show.title}
              className="bg-white rounded-2xl p-4 mb-3">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSelected(show)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${show.title}`}>
                <View className="flex-row items-start gap-3">
                  <View className="w-10 h-10 rounded-xl bg-primary-200 items-center justify-center">
                    <Text className="font-lato-black text-xs text-primary-800">
                      {showInitials(show.title)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-lato-bold text-base text-neutral-900">
                      {show.title}
                    </Text>
                    <Text className="font-lato text-xs text-neutral-600 mt-1">
                      {[show.venue, show.city]
                        .filter(Boolean)
                        .join(' · ') || appliedCity}
                    </Text>
                  </View>
                  {show.status ? (
                    <Badge
                      label={statusLabel(show.status)}
                      tone={show.status === '1' ? 'success' : 'neutral'}
                    />
                  ) : null}
                </View>

                <View className="flex-row flex-wrap gap-2 mt-3">
                  {show.date ? (
                    <View className="flex-row items-center gap-1 bg-neutral-200 rounded-full px-2.5 py-1">
                      <CalendarDays size={11} color="#565E74" />
                      <Text className="font-lato text-[11px] text-neutral-700">
                        {[show.date, show.time].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  ) : null}
                  {show.venue ? (
                    <View className="flex-row items-center gap-1 bg-primary-200 rounded-full px-2.5 py-1">
                      <MapPin size={11} color="#5279AC" />
                      <Text className="font-lato text-[11px] text-primary-700">
                        {show.venue}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {show.description ? (
                  <Text
                    className="font-lato text-xs text-neutral-600 mt-3 leading-5"
                    numberOfLines={2}>
                    {show.description}
                  </Text>
                ) : null}
              </TouchableOpacity>

              <View className="flex-row justify-end mt-3 pt-3 border-t border-neutral-200">
                <Button
                  title="View details"
                  size="sm"
                  variant="secondary"
                  onPress={() => setSelected(show)}
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
                <View className="flex-1">
                  <Text className="font-lato-black text-lg text-neutral-900">
                    {selected.title}
                  </Text>
                  <Text className="font-lato text-xs text-neutral-600 mt-1">
                    Show #{selected.id}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelected(null)}
                  className="w-9 h-9 rounded-full bg-neutral-200 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Close show details">
                  <X size={16} color="#6F778E" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {selected.status ? (
                    <Badge
                      label={statusLabel(selected.status)}
                      tone={selected.status === '1' ? 'success' : 'neutral'}
                    />
                  ) : null}
                  {selected.city ? (
                    <Badge label={selected.city} tone="primary" />
                  ) : null}
                </View>

                <DetailSection title="Show">
                  <DetailRow
                    icon={<CalendarDays size={15} color="#5279AC" />}
                    label="Date"
                    value={
                      [selected.date, selected.time]
                        .filter(Boolean)
                        .join(' · ') || '—'
                    }
                  />
                  <DetailRow
                    icon={<MapPin size={15} color="#5279AC" />}
                    label="Venue"
                    value={selected.venue || '—'}
                  />
                  <DetailRow
                    icon={<MapPin size={15} color="#5279AC" />}
                    label="City"
                    value={selected.city || appliedCity || '—'}
                  />
                </DetailSection>

                {selected.description ? (
                  <View className="pt-3 border-t border-neutral-200">
                    <Text className="font-lato-bold text-xs text-neutral-600 mb-1.5">
                      About this show
                    </Text>
                    <Text className="font-lato text-sm text-neutral-900 leading-5">
                      {selected.description}
                    </Text>
                  </View>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </DashboardLayout>
  );
}
