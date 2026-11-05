import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Building2,
  CalendarDays,
  Image as ImageIcon,
  MapPin,
  Store,
  Tag,
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
  fetchFranchise,
  type ModuleRow,
} from '../../services/moduleService';
import { describeApiError } from '../../services/httpClient';
import { IMAGE_BASE, pickString } from '../../services/utils';

interface FranchiseRecord {
  id: string;
  name: string;
  location: string;
  categoryId: string;
  description: string;
  status: string;
  logo: string;
  createdDate: string;
  createdTime: string;
  updatedDate: string;
  updatedTime: string;
  slug: string;
  raw: Record<string, unknown>;
}

function normalizeFranchise(row: ModuleRow): FranchiseRecord {
  const raw = row.raw;
  return {
    id: row.id || pickString(raw, ['f_id', 'franchise_id', 'id']),
    name:
      pickString(raw, ['f_brandName', 'name', 'title', 'franchise_name']) ||
      row.title,
    location: pickString(raw, [
      'f_brand_location',
      'city_name',
      'city',
      'address',
    ]),
    categoryId: pickString(raw, ['f_brandCategory', 'category_id']),
    description: pickString(raw, [
      'f_brandAbout',
      'description',
      'franchise_description',
      'desc',
    ]),
    status: pickString(raw, ['f_status', 'status', 'franchise_status']),
    logo: pickString(raw, ['f_brandLogo', 'logo', 'image']),
    createdDate: pickString(raw, ['f_createDate', 'created', 'created_at']),
    createdTime: pickString(raw, ['f_createTime', 'created_time']),
    updatedDate: pickString(raw, ['f_updateDate', 'updated_at']),
    updatedTime: pickString(raw, ['f_updateTime', 'updated_time']),
    slug: pickString(raw, ['f_slug', 'slug']),
    raw,
  };
}

function categoryLabel(categoryId: string): string {
  if (!categoryId || categoryId === '0') {
    return 'Uncategorized';
  }
  return `Category #${categoryId}`;
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

export function FranchiseScreen() {
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<FranchiseRecord | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchFranchise(force));
      setVisibleCount(20);
    } catch (loadError) {
      setRows([]);
      setError(describeApiError(loadError, 'Could not load franchise listings.'));
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

  const listings = useMemo(() => rows.map(normalizeFranchise), [rows]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return listings;
    }
    return listings.filter(listing =>
      [
        listing.name,
        listing.location,
        categoryLabel(listing.categoryId),
        listing.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [listings, query]);


  return (
    <DashboardLayout
      title="Franchise"
      subtitle="Franchise listings"
      showMenu
      onRefresh={refresh}
      refreshing={pullRefreshing}>
      <Card className="bg-white rounded-2xl p-4 mb-4">
        <TextField
          label="Search franchise listings"
          placeholder="Name, city, category or description"
          value={query}
          onChangeText={value => {
            setQuery(value);
            setVisibleCount(20);
          }}
        />
        <Badge
          label={`${filtered.length} of ${listings.length} listing${listings.length === 1 ? '' : 's'
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
            listings.length === 0
              ? 'No franchise listings found.'
              : 'No listings match that search.'
          }
        />
      ) : (
        <View style={{ opacity: loading ? 0.55 : 1 }}>
          {filtered.slice(0, visibleCount).map(listing => (
            <Card
              key={listing.id || listing.name}
              className="bg-white rounded-2xl p-4 mb-3">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSelected(listing)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${listing.name}`}>
                <View className="flex-row items-start gap-3">
                  <View className="w-10 h-10 rounded-xl bg-primary-200 items-center justify-center">
                    <Image source={{ uri: `${IMAGE_BASE}/${listing.logo}` }} className='w-full h-full' />
                  </View>
                  <View className="flex-1">
                    <Text className="font-lato-bold text-base text-neutral-900">
                      {listing.name}
                    </Text>
                    <Text
                      className="font-lato text-xs text-neutral-600 mt-1"
                      numberOfLines={2}>
                      {listing.location || 'Location not listed'}
                    </Text>
                  </View>
                  {listing.status ? (
                    <Badge
                      label={statusLabel(listing.status)}
                      tone={listing.status === '1' ? 'success' : 'neutral'}
                    />
                  ) : null}
                </View>

                <View className="flex-row flex-wrap gap-2 mt-3">
                  {listing.location ? (
                    <View className="flex-row items-center gap-1 bg-primary-200 rounded-full px-2.5 py-1">
                      <MapPin size={11} color="#5279AC" />
                      <Text
                        className="font-lato text-[11px] text-primary-700"
                        numberOfLines={1}>
                        {listing.location}
                      </Text>
                    </View>
                  ) : null}
                  {listing.categoryId && listing.categoryId !== '0' ? (
                    <View className="flex-row items-center gap-1 bg-neutral-200 rounded-full px-2.5 py-1">
                      <Tag size={11} color="#565E74" />
                      <Text className="font-lato text-[11px] text-neutral-700">
                        {categoryLabel(listing.categoryId)}
                      </Text>
                    </View>
                  ) : null}
                  {listing.createdDate ? (
                    <View className="flex-row items-center gap-1 bg-neutral-200 rounded-full px-2.5 py-1">
                      <CalendarDays size={11} color="#565E74" />
                      <Text className="font-lato text-[11px] text-neutral-700">
                        {listing.createdDate}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {listing.description ? (
                  <Text
                    className="font-lato text-xs text-neutral-600 mt-3 leading-5"
                    numberOfLines={2}>
                    {listing.description}
                  </Text>
                ) : null}
              </TouchableOpacity>

              <View className="flex-row justify-end mt-3 pt-3 border-t border-neutral-200">
                <Button
                  title="View details"
                  size="sm"
                  variant="secondary"
                  onPress={() => setSelected(listing)}
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
                    {selected.logo ? (
                      <Image source={{ uri: `${IMAGE_BASE}/${selected.logo}` }} />
                    ) : (
                      <Store size={20} color="#5279AC" />
                    )
                    }

                  </View>
                  <View className="flex-1">
                    <Text className="font-lato-black text-lg text-neutral-900">
                      {selected.name}
                    </Text>
                    <Text className="font-lato text-xs text-neutral-600 mt-0.5">
                      Franchise #{selected.id}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setSelected(null)}
                  className="w-9 h-9 rounded-full bg-neutral-200 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Close franchise details">
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
                  {selected.categoryId && selected.categoryId !== '0' ? (
                    <Badge
                      label={categoryLabel(selected.categoryId)}
                      tone="primary"
                    />
                  ) : null}
                  {selected.createdDate ? (
                    <Badge label={selected.createdDate} tone="secondary" />
                  ) : null}
                </View>

                <DetailSection title="Franchise">
                  <DetailRow
                    icon={<MapPin size={15} color="#5279AC" />}
                    label="Location"
                    value={selected.location || '—'}
                  />
                  <DetailRow
                    icon={<Tag size={15} color="#5279AC" />}
                    label="Category"
                    value={categoryLabel(selected.categoryId)}
                  />
                  <DetailRow
                    icon={<CalendarDays size={15} color="#5279AC" />}
                    label="Created"
                    value={
                      [selected.createdDate, selected.createdTime]
                        .filter(Boolean)
                        .join(' · ') || '—'
                    }
                  />
                  {selected.updatedDate ? (
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
                  <DetailRow
                    icon={<Building2 size={15} color="#5279AC" />}
                    label="Listing ID"
                    value={selected.id || '—'}
                  />
                  {selected.logo ? (
                    <DetailRow
                      icon={<ImageIcon size={15} color="#5279AC" />}
                      label="Logo"
                      value={selected.logo}
                    />
                  ) : null}
                  {selected.slug ? (
                    <DetailRow
                      icon={<Store size={15} color="#5279AC" />}
                      label="Slug"
                      value={selected.slug}
                    />
                  ) : null}
                </DetailSection>

                {selected.description ? (
                  <View className="pt-3 border-t border-neutral-200">
                    <Text className="font-lato-bold text-xs text-neutral-600 mb-1.5">
                      About this opportunity
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
