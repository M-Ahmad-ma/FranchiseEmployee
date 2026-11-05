import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
  Clock,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  Megaphone,
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
  fetchAdvertisements,
  type ModuleRow,
} from '../../services/moduleService';
import { describeApiError } from '../../services/httpClient';
import { IMAGE_BASE, pickString } from '../../services/utils';

interface AdvertRecord {
  id: string;
  title: string;
  description: string;
  status: string;
  date: string;
  time: string;
  updatedDate: string;
  updatedTime: string;
  image: string;
  slug: string;
  large: string;
  small: string;
  centerSlider: string;
  assignTo: string;
  raw: Record<string, unknown>;
}

function normalizeAdvert(row: ModuleRow): AdvertRecord {
  const raw = row.raw;
  return {
    id: row.id || pickString(raw, ['a_id', 'ads_id', 'ad_id', 'advert_id']),
    title:
      pickString(raw, ['a_name', 'title', 'ad_title', 'name']) || row.title,
    description: pickString(raw, ['a_description', 'description', 'desc']),
    status: pickString(raw, ['a_status', 'status', 'ad_status']),
    date: pickString(raw, ['a_date', 'date', 'created_at']),
    time: pickString(raw, ['a_time', 'time']),
    updatedDate: pickString(raw, ['a_updateddate', 'updated_at']),
    updatedTime: pickString(raw, ['a_updatetime', 'updated_time']),
    image: pickString(raw, ['a_img', 'image', 'img']),
    slug: pickString(raw, ['a_slug', 'slug']),
    large: pickString(raw, ['a_large']),
    small: pickString(raw, ['a_small']),
    centerSlider: pickString(raw, ['center_slider']),
    assignTo: pickString(raw, ['assign_to']),
    raw,
  };
}

function placementLabel(advert: AdvertRecord): string {
  const placements: string[] = [];
  if (advert.large === '1') {
    placements.push('Large');
  }
  if (advert.small === '1') {
    placements.push('Small');
  }
  if (advert.centerSlider === '1') {
    placements.push('Center slider');
  }
  return placements.join(' · ');
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}


function statusLabel(status: string): string {
  if (status === '1') {
    return 'Active';
  }
  if (status === '0') {
    return 'Inactive';
  }
  return status || 'Unknown';
}

export function AdvertisementsScreen() {
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AdvertRecord | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchAdvertisements(force));
      setVisibleCount(20);
    } catch (loadError) {
      setRows([]);
      setError(
        describeApiError(loadError, 'Could not load advertisements.'),
      );
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

  const adverts = useMemo(() => rows.map(normalizeAdvert), [rows]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return adverts;
    }
    return adverts.filter(advert =>
      [
        advert.title,
        advert.description,
        advert.date,
        advert.slug,
        advert.assignTo,
        placementLabel(advert),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [adverts, query]);

  return (
    <DashboardLayout
      title="Advertisements"
      subtitle="Published adverts"
      showMenu
      onRefresh={refresh}
      refreshing={pullRefreshing}>
      <Card className="bg-white rounded-2xl p-4 mb-4">
        <TextField
          label="Search advertisements"
          placeholder="Name, date, placement or link"
          value={query}
          onChangeText={value => {
            setQuery(value);
            setVisibleCount(20);
          }}
        />
        <Badge
          label={`${filtered.length} of ${adverts.length} advert${adverts.length === 1 ? '' : 's'
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
            adverts.length === 0
              ? 'No advertisements found.'
              : 'No advertisements match that search.'
          }
        />
      ) : (
        <View style={{ opacity: loading ? 0.55 : 1 }}>
          {filtered.slice(0, visibleCount).map(advert => (
            <Card
              key={advert.id || advert.title}
              className="bg-white rounded-2xl p-4 mb-3">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSelected(advert)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${advert.title}`}>
                <View className="flex-row items-start gap-3">
                  <View>
                    <Image source={{ uri: `${IMAGE_BASE}/${advert.image}` }} className='w-12 h-12' />
                  </View>


                  {/* <AdvertImage */}
                  {/*   image={advert.image} */}
                  {/*   title={advert.title} */}
                  {/*   width={64} */}
                  {/*   height={64} */}
                  {/* /> */}
                  <View className="flex-1">
                    <Text className="font-lato-bold text-base text-neutral-900">
                      {advert.title}
                    </Text>
                    <Text className="font-lato text-xs text-neutral-600 mt-1">
                      {[advert.date, advert.time].filter(Boolean).join(' · ') ||
                        'Date not set'}
                    </Text>
                    {placementLabel(advert) ? (
                      <Text className="font-lato text-[11px] text-primary-700 mt-1">
                        {placementLabel(advert)}
                      </Text>
                    ) : null}
                  </View>
                  <Badge
                    label={statusLabel(advert.status)}
                    tone={advert.status === '1' ? 'success' : 'neutral'}
                  />
                </View>

                {advert.description ? (
                  <Text
                    className="font-lato text-xs text-neutral-600 mt-3 leading-5"
                    numberOfLines={2}>
                    {isUrl(advert.description)
                      ? 'Company page link attached'
                      : advert.description}
                  </Text>
                ) : null}
              </TouchableOpacity>

              <View className="flex-row justify-end mt-3 pt-3 border-t border-neutral-200">
                <Button
                  title="View details"
                  size="sm"
                  variant="secondary"
                  onPress={() => setSelected(advert)}
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
                  <View className="w-12 h-12 rounded-xl bg-primary-200 items-center justify-center">
                    <Image source={{ uri: `${IMAGE_BASE}/${selected.image}` }} className='w-full h-full' />
                  </View>
                  <View className="flex-1">
                    <Text className="font-lato-black text-lg text-neutral-900">
                      {selected.title}
                    </Text>
                    <Text className="font-lato text-xs text-neutral-600 mt-0.5">
                      Advertisement #{selected.id}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setSelected(null)}
                  className="w-9 h-9 rounded-full bg-neutral-200 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Close advertisement details">
                  <X size={16} color="#6F778E" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {selected.image ? (
                  <View className="items-center mb-4">
                    <Image source={{ uri: `${IMAGE_BASE}/${selected.image}` }} className='h-16 w-full' />
                    {/* <AdvertImage */}
                    {/*   image={selected.image} */}
                    {/*   title={selected.title} */}
                    {/*   width={300} */}
                    {/*   height={160} */}
                    {/*   rounded={18} */}
                    {/* /> */}
                  </View>
                ) : null}

                <View className="flex-row flex-wrap gap-2 mb-4">
                  <Badge
                    label={statusLabel(selected.status)}
                    tone={selected.status === '1' ? 'success' : 'neutral'}
                  />
                  {placementLabel(selected) ? (
                    <Badge
                      label={placementLabel(selected)}
                      tone="primary"
                    />
                  ) : null}
                </View>

                <DetailSection title="Advertisement">
                  <DetailRow
                    icon={<CalendarDays size={15} color="#5279AC" />}
                    label="Date"
                    value={selected.date || '—'}
                  />
                  <DetailRow
                    icon={<Clock size={15} color="#5279AC" />}
                    label="Time"
                    value={selected.time || '—'}
                  />
                  <DetailRow
                    icon={<Layers size={15} color="#5279AC" />}
                    label="Placement"
                    value={placementLabel(selected) || '—'}
                  />
                  <DetailRow
                    icon={<ImageIcon size={15} color="#5279AC" />}
                    label="Image"
                    value={selected.image || '—'}
                  />
                  {selected.updatedDate || selected.updatedTime ? (
                    <DetailRow
                      icon={<CalendarDays size={15} color="#5279AC" />}
                      label="Updated"
                      value={
                        [selected.updatedDate, selected.updatedTime]
                          .filter(Boolean)
                          .join(' · ') || '—'
                      }
                    />
                  ) : null}
                  {selected.assignTo ? (
                    <DetailRow
                      icon={<Megaphone size={15} color="#5279AC" />}
                      label="Assigned"
                      value={selected.assignTo}
                    />
                  ) : null}
                  {selected.slug ? (
                    <DetailRow
                      icon={<Layers size={15} color="#5279AC" />}
                      label="Slug"
                      value={selected.slug}
                    />
                  ) : null}
                </DetailSection>

                {selected.description ? (
                  <View className="pt-3 border-t border-neutral-200">
                    <Text className="font-lato-bold text-xs text-neutral-600 mb-1.5">
                      {isUrl(selected.description)
                        ? 'Company page'
                        : 'Description'}
                    </Text>
                    {isUrl(selected.description) ? (
                      <>
                        <Text
                          className="font-lato text-xs text-neutral-600 leading-5"
                          numberOfLines={2}>
                          {selected.description}
                        </Text>
                        <Button
                          title="Open company page"
                          size="sm"
                          variant="outlined"
                          className="mt-3 self-start"
                          icon={<ExternalLink size={13} color="#5279AC" />}
                          onPress={() => {
                            void Linking.openURL(selected.description);
                          }}
                        />
                      </>
                    ) : (
                      <Text className="font-lato text-sm text-neutral-900 leading-5">
                        {selected.description}
                      </Text>
                    )}
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
