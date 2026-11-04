import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Building2,
  Globe2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  StickyNote,
  Tag,
  X,
} from 'lucide-react-native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { AlertBanner } from '../../shared/components/AlertBanner';
import { Badge } from '../../shared/components/Badge';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { TextField } from '../../shared/components/TextField';
import { useAuth } from '../../navigation/AuthContext';
import { P } from '../../services/permissions';
import {
  createBrand,
  fetchBrands,
  updateBrand,
  type ModuleRow,
} from '../../services/moduleService';
import { describeApiError } from '../../services/httpClient';
import { pickString } from '../../services/utils';

/**
 * Brands were being rendered as raw rows, so flags and ids were the most
 * visible content. This screen keeps the brand identity, category, location,
 * contact channels and description, while keeping the write form limited to the
 * fields the documented create/update endpoints accept.
 */

interface BrandRecord {
  id: string;
  name: string;
  category: string;
  city: string;
  status: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  description: string;
  categoryId: string;
  cityId: string;
  raw: Record<string, unknown>;
}

interface BrandForm {
  name: string;
  category_id: string;
  city_id: string;
}

const EMPTY_FORM: BrandForm = {
  name: '',
  category_id: '',
  city_id: '',
};

function normalizeBrand(row: ModuleRow): BrandRecord {
  const raw = row.raw;
  const categoryId = pickString(raw, ['category_id', 'cat_id']);
  const cityId = pickString(raw, ['city_id', 'c_id']);
  const categoryName = pickString(raw, [
    'category_name',
    'cat_name',
    'category',
  ]);
  const cityName = pickString(raw, ['city_name', 'city', 'c_city']);

  return {
    id: row.id || pickString(raw, ['brand_id', 'b_id', 'id', 'co_id']),
    name:
      pickString(raw, ['name', 'brand_name', 'b_name', 'co_name']) ||
      row.title,
    category:
      categoryName || (categoryId ? `Category #${categoryId}` : ''),
    city: cityName || (cityId ? `City #${cityId}` : ''),
    status: pickString(raw, ['status', 'brand_status', 'b_status', 'co_status']),
    website: pickString(raw, [
      'website',
      'brand_website',
      'co_website',
      'url',
    ]),
    email: pickString(raw, [
      'email',
      'brand_email',
      'co_email',
      'contact_email',
    ]),
    phone: pickString(raw, [
      'phone',
      'contact',
      'brand_phone',
      'co_phone',
      'con_mobilenumber',
    ]),
    address: pickString(raw, ['address', 'brand_address', 'location']),
    description: pickString(raw, [
      'description',
      'brand_description',
      'desc',
      'detail',
      'comment',
    ]),
    categoryId,
    cityId,
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
  return status || 'Unknown';
}

function brandInitials(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('') || 'B'
  );
}

function formFromBrand(brand: BrandRecord): BrandForm {
  return {
    name: brand.name,
    category_id: brand.categoryId,
    city_id: brand.cityId,
  };
}

export function BrandsScreen() {
  const { can } = useAuth();
  const canCreate = can(P.brandsAdd);
  const canEdit = can(P.brandsEdit);

  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<BrandRecord | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formRow, setFormRow] = useState<BrandRecord | null>(null);
  const [form, setForm] = useState<BrandForm>(EMPTY_FORM);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchBrands(force));
      setVisibleCount(20);
    } catch (loadError) {
      setRows([]);
      setError(describeApiError(loadError, 'Could not load brands.'));
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

  const brands = useMemo(() => rows.map(normalizeBrand), [rows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return brands;
    }
    return brands.filter(brand =>
      [
        brand.name,
        brand.category,
        brand.city,
        brand.email,
        brand.phone,
        brand.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [brands, query]);

  const openCreate = () => {
    setFormRow(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (brand: BrandRecord) => {
    setFormRow(brand);
    setForm(formFromBrand(brand));
    setFormError(null);
    setSelected(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (formSaving) {
      return;
    }
    setFormOpen(false);
    setFormRow(null);
    setFormError(null);
  };

  const setField = (key: keyof BrandForm, value: string) =>
    setForm(current => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!form.name.trim()) {
      setFormError('Brand name is required.');
      return;
    }

    const payload: Record<string, string> = {
      name: form.name.trim(),
      category_id: form.category_id.trim(),
      city_id: form.city_id.trim(),
    };

    setFormSaving(true);
    setFormError(null);
    try {
      if (formRow) {
        await updateBrand(formRow.id, payload);
      } else {
        await createBrand(payload);
      }
      setFormOpen(false);
      setFormRow(null);
      await load(true);
    } catch (saveError) {
      setFormError(
        describeApiError(saveError, 'Could not save this brand.'),
      );
    } finally {
      setFormSaving(false);
    }
  };

  return (
    <DashboardLayout
      title="Brands"
      subtitle="Browse, add and edit brands"
      showMenu
      onRefresh={refresh}
      refreshing={pullRefreshing}>
      <Card className="bg-white rounded-2xl p-4 mb-4">
        <TextField
          label="Search brands"
          placeholder="Name, category, city, email or phone"
          value={query}
          onChangeText={setQuery}
        />
        <View className="flex-row items-center justify-between gap-3">
          <Badge
            label={`${filtered.length} of ${brands.length} brand${
              brands.length === 1 ? '' : 's'
            }`}
          />
          {loading ? (
            <ActivityIndicator size="small" color="#5279AC" />
          ) : null}
        </View>
      </Card>

      <View className="flex-row items-center justify-between gap-3 mb-4">
        <Badge label={`${filtered.length} shown`} tone="neutral" />
        {canCreate ? (
          <Button
            title="Add brand"
            size="sm"
            icon={<Plus size={14} color="#FFFFFF" />}
            onPress={openCreate}
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
      ) : filtered.length === 0 ? (
        <AlertBanner
          message={
            brands.length === 0
              ? 'No brands found.'
              : 'No brands match that search.'
          }
        />
      ) : (
        <View style={{ opacity: loading ? 0.55 : 1 }}>
          {filtered.slice(0, visibleCount).map(brand => (
            <Card
              key={brand.id || brand.name}
              className="bg-white rounded-2xl p-4 mb-3">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSelected(brand)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${brand.name}`}>
                <View className="flex-row items-center gap-3">
                  <View className="w-11 h-11 rounded-xl bg-primary-200 items-center justify-center">
                    <Text className="font-lato-black text-sm text-primary-800">
                      {brandInitials(brand.name)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-lato-bold text-base text-neutral-900">
                      {brand.name}
                    </Text>
                    <Text className="font-lato text-xs text-neutral-600 mt-0.5">
                      {[brand.category, brand.city]
                        .filter(Boolean)
                        .join(' · ') || 'No category or city'}
                    </Text>
                  </View>
                  {brand.status ? (
                    <Badge
                      label={statusLabel(brand.status)}
                      tone={brand.status === '1' ? 'success' : 'neutral'}
                    />
                  ) : null}
                </View>

                <View className="flex-row flex-wrap gap-2 mt-3">
                  {brand.category ? (
                    <View className="flex-row items-center gap-1 bg-primary-200 rounded-full px-2.5 py-1">
                      <Tag size={11} color="#5279AC" />
                      <Text className="font-lato text-[11px] text-primary-700">
                        {brand.category}
                      </Text>
                    </View>
                  ) : null}
                  {brand.city ? (
                    <View className="flex-row items-center gap-1 bg-neutral-200 rounded-full px-2.5 py-1">
                      <MapPin size={11} color="#565E74" />
                      <Text className="font-lato text-[11px] text-neutral-700">
                        {brand.city}
                      </Text>
                    </View>
                  ) : null}
                  {brand.phone ? (
                    <View className="flex-row items-center gap-1 bg-neutral-200 rounded-full px-2.5 py-1">
                      <Phone size={11} color="#565E74" />
                      <Text className="font-lato text-[11px] text-neutral-700">
                        {brand.phone}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {brand.description ? (
                  <Text
                    className="font-lato text-xs text-neutral-600 mt-3 leading-5"
                    numberOfLines={2}>
                    {brand.description}
                  </Text>
                ) : null}
              </TouchableOpacity>

              <View className="flex-row justify-end gap-2 mt-3 pt-3 border-t border-neutral-200">
                <Button
                  title="View"
                  size="sm"
                  variant="secondary"
                  onPress={() => setSelected(brand)}
                />
                {canEdit ? (
                  <Button
                    title="Edit"
                    size="sm"
                    variant="outlined"
                    icon={<Pencil size={13} color="#5279AC" />}
                    onPress={() => openEdit(brand)}
                  />
                ) : null}
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

      {/* Brand detail */}
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
                    <Text className="font-lato-black text-base text-primary-800">
                      {brandInitials(selected.name)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-lato-black text-lg text-neutral-900">
                      {selected.name}
                    </Text>
                    <Text className="font-lato text-xs text-neutral-600 mt-0.5">
                      Brand #{selected.id}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setSelected(null)}
                  className="w-9 h-9 rounded-full bg-neutral-200 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Close brand details">
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
                  {selected.category ? (
                    <Badge label={selected.category} tone="primary" />
                  ) : null}
                  {selected.city ? (
                    <Badge label={selected.city} tone="secondary" />
                  ) : null}
                </View>

                <DetailSection title="Brand">
                  <DetailRow
                    icon={<Tag size={15} color="#5279AC" />}
                    label="Category"
                    value={selected.category || '—'}
                  />
                  <DetailRow
                    icon={<MapPin size={15} color="#5279AC" />}
                    label="City"
                    value={selected.city || '—'}
                  />
                  <DetailRow
                    icon={<Building2 size={15} color="#5279AC" />}
                    label="Address"
                    value={selected.address || '—'}
                  />
                </DetailSection>

                {selected.email || selected.phone || selected.website ? (
                  <DetailSection title="Contact">
                    {selected.email ? (
                      <DetailRow
                        icon={<Mail size={15} color="#5279AC" />}
                        label="Email"
                        value={selected.email}
                      />
                    ) : null}
                    {selected.phone ? (
                      <DetailRow
                        icon={<Phone size={15} color="#5279AC" />}
                        label="Phone"
                        value={selected.phone}
                      />
                    ) : null}
                    {selected.website ? (
                      <DetailRow
                        icon={<Globe2 size={15} color="#5279AC" />}
                        label="Website"
                        value={selected.website}
                      />
                    ) : null}
                  </DetailSection>
                ) : null}

                {selected.description ? (
                  <View className="pt-3 border-t border-neutral-200">
                    <View className="flex-row items-center gap-1.5 mb-1.5">
                      <StickyNote size={14} color="#5279AC" />
                      <Text className="font-lato-bold text-xs text-neutral-600">
                        About this brand
                      </Text>
                    </View>
                    <Text className="font-lato text-sm text-neutral-900 leading-5">
                      {selected.description}
                    </Text>
                  </View>
                ) : null}
              </ScrollView>

              {canEdit ? (
                <Button
                  title="Edit brand"
                  size="lg"
                  className="mt-4"
                  icon={<Pencil size={16} color="#FFFFFF" />}
                  onPress={() => openEdit(selected)}
                />
              ) : null}
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Create / edit brand */}
      {formOpen ? (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={closeForm}>
          <View className="flex-1 bg-black/40 justify-end">
            <View className="bg-white rounded-t-3xl max-h-[92%]">
              <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
                <View>
                  <Text className="font-lato-black text-lg text-neutral-900">
                    {formRow ? 'Edit brand' : 'Add brand'}
                  </Text>
                  <Text className="font-lato text-xs text-neutral-600 mt-0.5">
                    {formRow
                      ? formRow.name
                      : 'Name, category and city'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={closeForm}
                  disabled={formSaving}
                  className="w-9 h-9 rounded-full bg-neutral-200 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Close form">
                  <X size={16} color="#6F778E" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                className="px-5">
                <TextField
                  label="Brand name"
                  required
                  value={form.name}
                  onChangeText={value => setField('name', value)}
                />
                <TextField
                  label="Category ID"
                  placeholder="Enter the category id used by the server"
                  value={form.category_id}
                  onChangeText={value => setField('category_id', value)}
                  keyboardType="numeric"
                />
                <TextField
                  label="City ID"
                  placeholder="Enter the city id used by the server"
                  value={form.city_id}
                  onChangeText={value => setField('city_id', value)}
                  keyboardType="numeric"
                />

                {formError ? (
                  <Text className="text-red-500 text-sm font-lato mb-3 text-center">
                    {formError}
                  </Text>
                ) : null}
              </ScrollView>

              <View className="flex-row gap-3 px-5 pt-2 pb-6">
                <Button
                  title="Cancel"
                  size="lg"
                  variant="secondary"
                  className="flex-1"
                  disabled={formSaving}
                  onPress={closeForm}
                />
                <Button
                  title={formRow ? 'Save changes' : 'Add brand'}
                  size="lg"
                  className="flex-1"
                  loading={formSaving}
                  onPress={() => void submit()}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </DashboardLayout>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-4">
      <Text className="font-lato-bold text-[10px] uppercase tracking-[1px] text-neutral-600 mb-1.5">
        {title}
      </Text>
      <Card className="bg-neutral-100 rounded-2xl p-3">{children}</Card>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-2 py-1.5">
      {icon}
      <Text className="font-lato text-xs text-neutral-600 w-20">{label}</Text>
      <Text className="font-lato text-sm text-neutral-900 flex-1">
        {value}
      </Text>
    </View>
  );
}
