import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { AlertBanner } from '../../shared/components/AlertBanner';
import { Badge } from '../../shared/components/Badge';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { DateField } from '../../shared/components/DateField';
import { SelectField } from '../../shared/components/SelectField';
import { TextField } from '../../shared/components/TextField';
import { useAuth } from '../../navigation/AuthContext';
import { MODULE_CONFIGS, SHOWS_LOADER } from '../../navigation/modules';
import type {
  ModuleFormField,
  ModuleRoute,
  RootStackParamList,
} from '../../navigation/types';
import type { ModuleRow } from '../../services/moduleService';
import { describeApiError } from '../../services/httpClient';
import { toApiDate, type Option } from '../../services/utils';

/**
 * One screen implementation for the list/create/edit/delete modules that share
 * the same shape. The registry in `navigation/modules.ts` supplies the
 * endpoints, permissions and form fields; this file supplies the behaviour.
 */
export function ModuleScreen() {
  const route = useRoute<RouteProp<RootStackParamList, ModuleRoute>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { canAll } = useAuth();
  const config = MODULE_CONFIGS[route.name as ModuleRoute];

  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(!config?.requiresCity);
  const [error, setError] = useState<string | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [city, setCity] = useState('');
  const [appliedCity, setAppliedCity] = useState('');
  const [selected, setSelected] = useState<ModuleRow | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formRow, setFormRow] = useState<ModuleRow | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [formOptions, setFormOptions] = useState<Record<string, Option[]>>({});
  const [formLoading, setFormLoading] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canCreate = Boolean(
    config?.createFn && config.create && canAll(config.create),
  );
  const canEdit = Boolean(
    config?.updateFn && config.edit && canAll(config.edit),
  );
  const canDelete = Boolean(
    config?.deleteFn && config.delete && canAll(config.delete),
  );

  const load = useCallback(
    async (targetCity?: string) => {
      if (!config) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const next = config.requiresCity
          ? await SHOWS_LOADER(targetCity ?? '')
          : await config.load();
        setRows(next);
      } catch (loadError) {
        setRows([]);
        setError(
          describeApiError(loadError, 'Could not load this section.'),
        );
      } finally {
        setLoading(false);
      }
    },
    [config],
  );

  useFocusEffect(
    useCallback(() => {
      if (config && !config.requiresCity) {
        void load();
      }
    }, [config, load]),
  );

  const refresh = useCallback(async () => {
    if (config?.requiresCity && !appliedCity) {
      return;
    }
    setPullRefreshing(true);
    try {
      await load(config?.requiresCity ? appliedCity : undefined);
    } finally {
      setPullRefreshing(false);
    }
  }, [appliedCity, config?.requiresCity, load]);

  const applyCity = () => {
    const trimmed = city.trim();
    setAppliedCity(trimmed);
    if (trimmed) {
      void load(trimmed);
    } else {
      setRows([]);
      setError(null);
    }
  };

  const openCreate = async () => {
    if (!config) {
      return;
    }
    setFormRow(null);
    setFormOpen(true);
    setFormError(null);
    setFormLoading(true);
    const initial: Record<string, string> = {};
    for (const field of config.fields ?? []) {
      initial[field.key] = '';
    }
    setFormValues(initial);
    try {
      const options = config.loadOptions ? await config.loadOptions() : {};
      setFormOptions(options);
    } catch {
      setFormOptions({});
    } finally {
      setFormLoading(false);
    }
  };

  const openEdit = async (row: ModuleRow) => {
    if (!config) {
      return;
    }
    setFormRow(row);
    setFormOpen(true);
    setFormError(null);
    setFormLoading(true);
    setFormValues({ ...row.values });
    try {
      const loadedOptions = config.loadOptions ? await config.loadOptions() : {};
      setFormOptions(loadedOptions);
      if (config.loadEdit) {
        const edit = await config.loadEdit(row.id);
        setFormValues(current => ({ ...current, ...edit.values }));
        if (edit.options) {
          setFormOptions(current => ({ ...current, ...edit.options }));
        }
      }
    } catch (editError) {
      setFormError(
        describeApiError(editError, 'Could not load the edit form.'),
      );
    } finally {
      setFormLoading(false);
    }
  };

  console.log("line 178 ModuleScreen", config)

  const closeForm = () => {
    if (formSaving) {
      return;
    }
    setFormOpen(false);
    setFormRow(null);
    setFormError(null);
  };

  const setValue = (key: string, value: string) =>
    setFormValues(current => ({ ...current, [key]: value }));

  const submitForm = async () => {
    if (!config) {
      return;
    }
    const fields = config.fields ?? [];
    const missing = fields.find(
      field => field.required && !(formValues[field.key] ?? '').trim(),
    );
    if (missing) {
      setFormError(`${missing.label} is required.`);
      return;
    }

    const payload: Record<string, string> = {};
    for (const field of fields) {
      const rawValue = (formValues[field.key] ?? '').trim();
      if (!rawValue) {
        continue;
      }
      payload[field.key] =
        field.type === 'date' ? (toApiDate(rawValue) ?? rawValue) : rawValue;
    }

    setFormSaving(true);
    setFormError(null);
    try {
      if (formRow && config.updateFn) {
        await config.updateFn(formRow.id, payload);
      } else if (config.createFn) {
        await config.createFn(payload);
      }
      setFormOpen(false);
      setFormRow(null);
      await load(config.requiresCity ? appliedCity : undefined);
    } catch (submitError) {
      setFormError(
        describeApiError(submitError, 'Could not save this record.'),
      );
    } finally {
      setFormSaving(false);
    }
  };

  const confirmDelete = (row: ModuleRow) => {
    if (!config?.deleteFn) {
      return;
    }
    Alert.alert(
      `Delete ${singularLabel(config.label)}`,
      `Delete "${row.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await config.deleteFn?.(row.id);
                setRows(current => current.filter(item => item.id !== row.id));
              } catch (deleteError) {
                setError(
                  describeApiError(deleteError, 'Could not delete this record.'),
                );
              }
            })();
          },
        },
      ],
    );
  };

  const openRow = (row: ModuleRow) => {
    if (config?.opensLead) {
      const leadId = row.values.e_id || row.id;
      if (!leadId) {
        return;
      }
      navigation.navigate('LeadDetail', {
        leadId,
        investor: row.title,
        phone: row.values.e_phonenumber,
        company: row.values.co_name,
        e_co_id: row.values.e_co_id,
      });
      return;
    }
    setSelected(row);
  };

  const visibleDetails = useMemo(
    () => (selected ? selected.details.slice(0, 12) : []),
    [selected],
  );

  if (!config) {
    return (
      <DashboardLayout title="Unavailable" showMenu>
        <AlertBanner message="This section is not configured." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={config.label}
      subtitle={config.hint}
      showMenu
      onRefresh={refresh}
      refreshing={pullRefreshing}>
      {config.requiresCity ? (
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
            onPress={applyCity}
          />
        </Card>
      ) : null}

      <View className="flex-row items-center justify-between gap-3 mb-4">
        <Badge label={`${rows.length} record${rows.length === 1 ? '' : 's'}`} />
        {canCreate ? (
          <Button
            title={`Add ${singularLabel(config.label)}`}
            size="sm"
            icon={<Plus size={14} color="#FFFFFF" />}
            onPress={() => void openCreate()}
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
        <AlertBanner message={config.emptyMessage} />
      ) : (
        <View style={{ opacity: loading ? 0.55 : 1 }}>
          {rows.map(row => (
            <Card key={row.id || row.title} className="bg-white rounded-2xl p-4 mb-3">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => openRow(row)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${row.title}`}>
                <Text className="font-lato-bold text-base text-neutral-900">
                  {row.title}
                </Text>
                {row.subtitle ? (
                  <Text className="font-lato text-xs text-neutral-600 mt-1">
                    {row.subtitle}
                  </Text>
                ) : null}

                {row.details.length > 0 ? (
                  <View className="flex-row flex-wrap gap-2 mt-3">
                    {row.details.slice(0, 4).map((detail, index) => (
                      <View
                        key={`${detail.label}-${index}`}
                        className="bg-primary-200 rounded-full px-2.5 py-1">
                        <Text className="font-lato text-[11px] text-primary-700">
                          {detail.label}: {detail.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </TouchableOpacity>

              {(canEdit || canDelete) && row.id ? (
                <View className="flex-row justify-end gap-2 mt-3 pt-3 border-t border-neutral-200">
                  {canEdit ? (
                    <Button
                      title="Edit"
                      size="sm"
                      variant="outlined"
                      icon={<Pencil size={13} color="#5279AC" />}
                      onPress={() => void openEdit(row)}
                    />
                  ) : null}
                  {canDelete ? (
                    <Button
                      title="Delete"
                      size="sm"
                      variant="outlined"
                      icon={<Trash2 size={13} color="#5279AC" />}
                      onPress={() => confirmDelete(row)}
                    />
                  ) : null}
                </View>
              ) : null}
            </Card>
          ))}
        </View>
      )}

      {/* Read-only detail */}
      <Modal
        visible={selected !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[88%] px-5 pt-5 pb-6">
            <View className="flex-row items-center justify-between gap-3 mb-4">
              <View className="flex-1">
                <Text className="font-lato-black text-lg text-neutral-900">
                  {selected?.title}
                </Text>
                {selected?.subtitle ? (
                  <Text className="font-lato text-xs text-neutral-600 mt-1">
                    {selected.subtitle}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => setSelected(null)}
                className="w-9 h-9 rounded-full bg-neutral-200 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Close details">
                <X size={16} color="#6F778E" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {visibleDetails.length === 0 ? (
                <Text className="font-lato text-sm text-neutral-600">
                  This record has no additional details.
                </Text>
              ) : (
                visibleDetails.map((detail, index) => (
                  <View
                    key={`${detail.label}-${index}`}
                    className="flex-row gap-3 py-2.5 border-b border-neutral-200">
                    <Text className="font-lato-bold text-xs text-neutral-600 w-28">
                      {detail.label}
                    </Text>
                    <Text className="font-lato text-sm text-neutral-900 flex-1">
                      {detail.value}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            {canEdit && selected?.id ? (
              <Button
                title="Edit record"
                size="lg"
                className="mt-4"
                icon={<Pencil size={16} color="#FFFFFF" />}
                onPress={() => {
                  const row = selected;
                  setSelected(null);
                  void openEdit(row);
                }}
              />
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Create / edit form */}
      <Modal
        visible={formOpen}
        transparent
        animationType="slide"
        onRequestClose={closeForm}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[92%]">
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
              <Text className="font-lato-black text-lg text-neutral-900">
                {formRow ? `Edit ${singularLabel(config.label)}` : `Add ${singularLabel(config.label)}`}
              </Text>
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
              {formLoading ? (
                <View className="items-center py-8">
                  <ActivityIndicator color="#5279AC" />
                </View>
              ) : (
                (config.fields ?? []).map(field => (
                  <FormField
                    key={field.key}
                    field={field}
                    value={formValues[field.key] ?? ''}
                    options={formOptions[field.optionsKey ?? ''] ?? []}
                    onChange={value => setValue(field.key, value)}
                  />
                ))
              )}

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
                title="Save"
                size="lg"
                className="flex-1"
                loading={formSaving}
                disabled={formLoading}
                onPress={() => void submitForm()}
              />
            </View>
          </View>
        </View>
      </Modal>
    </DashboardLayout>
  );
}

/** "Companies" -> "Company", "Properties" -> "Property". */
function singularLabel(label: string): string {
  if (/ies$/i.test(label)) {
    return label.replace(/ies$/i, 'y');
  }
  if (/s$/i.test(label) && !/ss$/i.test(label)) {
    return label.replace(/s$/i, '');
  }
  return label;
}

function FormField({
  field,
  value,
  options,
  onChange,
}: {
  field: ModuleFormField;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  switch (field.type) {
    case 'select':
      return (
        <SelectField
          label={field.label}
          required={field.required}
          placeholder={field.placeholder ?? `Select ${field.label.toLowerCase()}`}
          value={value || undefined}
          options={options}
          onChange={onChange}
          searchable
        />
      );
    case 'date':
      return (
        <DateField
          label={field.label}
          required={field.required}
          value={displayDate(value)}
          onChange={onChange}
        />
      );
    case 'multiline':
      return (
        <TextField
          label={field.label}
          required={field.required}
          placeholder={field.placeholder}
          value={value}
          onChangeText={onChange}
          multiline
        />
      );
    case 'number':
      return (
        <TextField
          label={field.label}
          required={field.required}
          placeholder={field.placeholder}
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
        />
      );
    default:
      return (
        <TextField
          label={field.label}
          required={field.required}
          placeholder={field.placeholder}
          value={value}
          onChangeText={onChange}
        />
      );
  }
}

/** `DateField` shows mm/dd/yyyy, while API rows often carry YYYY-MM-DD. */
function displayDate(value: string): string {
  const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!iso) {
    return value;
  }
  return `${iso[2]}/${iso[3]}/${iso[1]}`;
}

