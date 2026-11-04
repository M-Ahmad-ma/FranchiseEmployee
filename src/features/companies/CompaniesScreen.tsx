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
  CalendarDays,
  Globe2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  StickyNote,
  UserRound,
  X,
} from 'lucide-react-native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { AlertBanner } from '../../shared/components/AlertBanner';
import { Badge } from '../../shared/components/Badge';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { SelectField } from '../../shared/components/SelectField';
import { TextField } from '../../shared/components/TextField';
import { useAuth } from '../../navigation/AuthContext';
import { P } from '../../services/permissions';
import {
  createCompany,
  fetchCompanies,
  fetchCompanyEdit,
  updateCompany,
  type CompanyOptions,
  type ModuleRow,
} from '../../services/moduleService';
import { describeApiError } from '../../services/httpClient';
import { pickString } from '../../services/utils';

/**
 * Companies have two layers: the company record and one or more contact people
 * (`company_contacts`). The generic row dumped raw status flags and object
 * fields, so this screen keeps the readable company/contact model.
 */

interface CompanyContact {
  id: string;
  name: string;
  designation: string;
  email: string;
  phone: string;
  date: string;
}

interface CompanyRecord {
  id: string;
  name: string;
  status: string;
  websiteStatus: string;
  comment: string;
  contacts: CompanyContact[];
  primaryContact: CompanyContact | null;
  raw: Record<string, unknown>;
}

interface CompanyForm {
  name: string;
  category_id: string;
  country_id: string;
  city_id: string;
  con_p_name: string;
  con_desgnation: string;
  con_email: string;
  con_mobilenumber: string;
}

const EMPTY_OPTIONS: CompanyOptions = { countries: [], categories: [] };

const EMPTY_FORM: CompanyForm = {
  name: '',
  category_id: '',
  country_id: '',
  city_id: '',
  con_p_name: '',
  con_desgnation: '',
  con_email: '',
  con_mobilenumber: '',
};

function normalizeContact(row: Record<string, unknown>): CompanyContact {
  return {
    id: pickString(row, ['con_id', 'id']),
    name: pickString(row, ['con_p_name', 'contact_person', 'name']),
    designation: pickString(row, ['con_desgnation', 'designation']),
    email: pickString(row, ['con_email', 'email']),
    phone: pickString(row, ['con_mobilenumber', 'phone', 'contact']),
    date: pickString(row, ['con_date', 'date']),
  };
}

function normalizeCompany(row: ModuleRow): CompanyRecord {
  const raw = row.raw;
  const fromArray = Array.isArray(raw.company_contacts)
    ? raw.company_contacts
        .filter((contact): contact is Record<string, unknown> =>
          Boolean(contact) && typeof contact === 'object' && !Array.isArray(contact),
        )
        .map(normalizeContact)
    : [];

  // Some responses only expose the denormalised primary contact fields.
  const primaryFromCompany: CompanyContact = {
    id: '',
    name: pickString(raw, ['con_p_name']),
    designation: pickString(raw, ['con_desgnation']),
    email: pickString(raw, ['con_email']),
    phone: pickString(raw, ['con_mobilenumber']),
    date: '',
  };

  const contacts = fromArray.length > 0 ? fromArray : [primaryFromCompany];
  const populatedContacts = contacts.filter(
    contact =>
      contact.name ||
      contact.email ||
      contact.phone ||
      contact.designation,
  );

  return {
    id: row.id || pickString(raw, ['co_id', 'company_id', 'id']),
    name: pickString(raw, ['co_name', 'company_name', 'name']) || row.title,
    status: pickString(raw, ['co_status', 'status']),
    websiteStatus: pickString(raw, ['co_website_status', 'website_status']),
    comment: pickString(raw, ['e_comment', 'comment']),
    contacts: populatedContacts,
    primaryContact: populatedContacts[0] ?? null,
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

function websiteLabel(status: string): string {
  if (status === '1') {
    return 'Website listed';
  }
  if (status === '0') {
    return 'Website not listed';
  }
  return 'Website unknown';
}

function initialsFor(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('') || 'C'
  );
}

function formFromCompany(company: CompanyRecord): CompanyForm {
  const raw = company.raw;
  const contact = company.primaryContact;
  return {
    name: company.name,
    category_id: pickString(raw, ['category_id', 'cat_id']),
    country_id: pickString(raw, ['country_id', 'c_id']),
    city_id: pickString(raw, ['city_id', 'city']),
    con_p_name: contact?.name ?? pickString(raw, ['con_p_name']),
    con_desgnation:
      contact?.designation ?? pickString(raw, ['con_desgnation']),
    con_email: contact?.email ?? pickString(raw, ['con_email']),
    con_mobilenumber:
      contact?.phone ?? pickString(raw, ['con_mobilenumber']),
  };
}

export function CompaniesScreen() {
  const { can } = useAuth();
  const canCreate = can(P.companiesAdd);
  const canEdit = can(P.companiesEdit);

  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [options, setOptions] = useState<CompanyOptions>(EMPTY_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CompanyRecord | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formRow, setFormRow] = useState<CompanyRecord | null>(null);
  const [form, setForm] = useState<CompanyForm>(EMPTY_FORM);
  const [formSaving, setFormSaving] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCompanies(force);
      setRows(result.rows);
      setOptions(result.options);
      setVisibleCount(20);
    } catch (loadError) {
      setRows([]);
      setError(describeApiError(loadError, 'Could not load companies.'));
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

  const companies = useMemo(() => rows.map(normalizeCompany), [rows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return companies;
    }
    return companies.filter(company =>
      [
        company.name,
        company.primaryContact?.name,
        company.primaryContact?.email,
        company.primaryContact?.phone,
        company.comment,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [companies, query]);

  const openCreate = async () => {
    setFormRow(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
    setFormError(null);
    setFormLoading(true);
    try {
      const result = await fetchCompanies();
      setOptions(result.options);
    } catch {
      // The form can still be submitted with the fields already filled.
    } finally {
      setFormLoading(false);
    }
  };

  const openEdit = async (company: CompanyRecord) => {
    setFormRow(company);
    setForm(formFromCompany(company));
    setFormOpen(true);
    setFormError(null);
    setFormLoading(true);
    try {
      const [edit, list] = await Promise.all([
        fetchCompanyEdit(company.id),
        fetchCompanies(),
      ]);
      setOptions(edit.options ?? list.options);
      setForm(current => ({
        ...current,
        ...formFromCompany(company),
        ...mapEditValues(edit.values),
      }));
    } catch (editError) {
      setFormError(
        describeApiError(editError, 'Could not load the company form.'),
      );
    } finally {
      setFormLoading(false);
    }
  };

  const closeForm = () => {
    if (formSaving) {
      return;
    }
    setFormOpen(false);
    setFormRow(null);
    setFormError(null);
  };

  const setField = (key: keyof CompanyForm, value: string) =>
    setForm(current => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!form.name.trim()) {
      setFormError('Company name is required.');
      return;
    }

    const payload: Record<string, string> = {
      name: form.name.trim(),
      category_id: form.category_id.trim(),
      country_id: form.country_id.trim(),
      city_id: form.city_id.trim(),
      con_p_name: form.con_p_name.trim(),
      con_desgnation: form.con_desgnation.trim(),
      con_email: form.con_email.trim(),
      con_mobilenumber: form.con_mobilenumber.trim(),
    };

    setFormSaving(true);
    setFormError(null);
    try {
      if (formRow) {
        await updateCompany(formRow.id, payload);
      } else {
        await createCompany(payload);
      }
      setFormOpen(false);
      setFormRow(null);
      await load(true);
    } catch (saveError) {
      setFormError(
        describeApiError(saveError, 'Could not save this company.'),
      );
    } finally {
      setFormSaving(false);
    }
  };

  return (
    <DashboardLayout
      title="Companies"
      subtitle="Company directory and contacts"
      showMenu
      onRefresh={refresh}
      refreshing={pullRefreshing}>
      <Card className="bg-white rounded-2xl p-4 mb-4">
        <TextField
          label="Search companies"
          placeholder="Name, contact, email or phone"
          value={query}
          onChangeText={setQuery}
        />
        <View className="flex-row items-center justify-between gap-3">
          <Badge
            label={`${filtered.length} of ${companies.length} compan${
              companies.length === 1 ? 'y' : 'ies'
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
            title="Add company"
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
      ) : filtered.length === 0 ? (
        <AlertBanner
          message={
            companies.length === 0
              ? 'No companies found.'
              : 'No companies match that search.'
          }
        />
      ) : (
        <View style={{ opacity: loading ? 0.55 : 1 }}>
          {filtered.slice(0, visibleCount).map(company => (
            <Card
              key={company.id || company.name}
              className="bg-white rounded-2xl p-4 mb-3">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSelected(company)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${company.name}`}>
                <View className="flex-row items-center gap-3">
                  <View className="w-11 h-11 rounded-xl bg-primary-200 items-center justify-center">
                    <Text className="font-lato-black text-sm text-primary-800">
                      {initialsFor(company.name)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-lato-bold text-base text-neutral-900">
                      {company.name}
                    </Text>
                    <Text className="font-lato text-xs text-neutral-600 mt-0.5">
                      {company.primaryContact?.name ||
                        company.primaryContact?.email ||
                        'No contact person'}
                    </Text>
                  </View>
                  <Badge
                    label={statusLabel(company.status)}
                    tone={company.status === '1' ? 'success' : 'neutral'}
                  />
                </View>

                <View className="flex-row flex-wrap gap-2 mt-3">
                  {company.primaryContact?.phone ? (
                    <View className="flex-row items-center gap-1 bg-primary-200 rounded-full px-2.5 py-1">
                      <Phone size={11} color="#5279AC" />
                      <Text className="font-lato text-[11px] text-primary-700">
                        {company.primaryContact.phone}
                      </Text>
                    </View>
                  ) : null}
                  {company.primaryContact?.email ? (
                    <View className="flex-row items-center gap-1 bg-neutral-200 rounded-full px-2.5 py-1">
                      <Mail size={11} color="#565E74" />
                      <Text className="font-lato text-[11px] text-neutral-700">
                        {company.primaryContact.email}
                      </Text>
                    </View>
                  ) : null}
                  <View className="flex-row items-center gap-1 bg-neutral-200 rounded-full px-2.5 py-1">
                    <Globe2 size={11} color="#565E74" />
                    <Text className="font-lato text-[11px] text-neutral-700">
                      {websiteLabel(company.websiteStatus)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <View className="flex-row justify-end gap-2 mt-3 pt-3 border-t border-neutral-200">
                <Button
                  title="View"
                  size="sm"
                  variant="secondary"
                  onPress={() => setSelected(company)}
                />
                {canEdit ? (
                  <Button
                    title="Edit"
                    size="sm"
                    variant="outlined"
                    icon={<Pencil size={13} color="#5279AC" />}
                    onPress={() => void openEdit(company)}
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

      {/* Company detail */}
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
                      {initialsFor(selected.name)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-lato-black text-lg text-neutral-900">
                      {selected.name}
                    </Text>
                    <Text className="font-lato text-xs text-neutral-600 mt-0.5">
                      Company #{selected.id}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setSelected(null)}
                  className="w-9 h-9 rounded-full bg-neutral-200 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Close company details">
                  <X size={16} color="#6F778E" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  <Badge
                    label={statusLabel(selected.status)}
                    tone={selected.status === '1' ? 'success' : 'neutral'}
                  />
                  <Badge
                    label={websiteLabel(selected.websiteStatus)}
                    tone={selected.websiteStatus === '1' ? 'primary' : 'neutral'}
                  />
                </View>

                <DetailSection title="Primary contact">
                  {selected.primaryContact ? (
                    <>
                      <DetailRow
                        icon={<UserRound size={15} color="#5279AC" />}
                        label="Name"
                        value={selected.primaryContact.name || '—'}
                      />
                      <DetailRow
                        icon={<Building2 size={15} color="#5279AC" />}
                        label="Designation"
                        value={selected.primaryContact.designation || '—'}
                      />
                      <DetailRow
                        icon={<Mail size={15} color="#5279AC" />}
                        label="Email"
                        value={selected.primaryContact.email || '—'}
                      />
                      <DetailRow
                        icon={<Phone size={15} color="#5279AC" />}
                        label="Phone"
                        value={selected.primaryContact.phone || '—'}
                      />
                    </>
                  ) : (
                    <Text className="font-lato text-sm text-neutral-600">
                      No contact person recorded.
                    </Text>
                  )}
                </DetailSection>

                {selected.contacts.length > 1 ? (
                  <DetailSection title="All contacts">
                    {selected.contacts.map((contact, index) => (
                      <View
                        key={contact.id || index}
                        className={
                          index > 0
                            ? 'pt-3 mt-3 border-t border-neutral-200'
                            : ''
                        }>
                        <Text className="font-lato-bold text-sm text-neutral-900">
                          {contact.name || 'Unnamed contact'}
                        </Text>
                        <Text className="font-lato text-xs text-neutral-600 mt-0.5">
                          {[contact.designation, contact.email, contact.phone]
                            .filter(Boolean)
                            .join(' · ') || 'No contact details'}
                        </Text>
                      </View>
                    ))}
                  </DetailSection>
                ) : null}

                <DetailSection title="Company">
                  <DetailRow
                    icon={<Globe2 size={15} color="#5279AC" />}
                    label="Website"
                    value={websiteLabel(selected.websiteStatus)}
                  />
                  <DetailRow
                    icon={<MapPin size={15} color="#5279AC" />}
                    label="City"
                    value={
                      pickString(selected.raw, ['city_name', 'city']) || '—'
                    }
                  />
                  <DetailRow
                    icon={<CalendarDays size={15} color="#5279AC" />}
                    label="Created"
                    value={
                      pickString(selected.raw, ['co_date', 'created_at']) || '—'
                    }
                  />
                </DetailSection>

                {selected.comment ? (
                  <View className="pt-3 border-t border-neutral-200">
                    <View className="flex-row items-center gap-1.5 mb-1.5">
                      <StickyNote size={14} color="#5279AC" />
                      <Text className="font-lato-bold text-xs text-neutral-600">
                        Notes
                      </Text>
                    </View>
                    <Text className="font-lato text-sm text-neutral-900 leading-5">
                      {selected.comment}
                    </Text>
                  </View>
                ) : null}
              </ScrollView>

              {canEdit ? (
                <Button
                  title="Edit company"
                  size="lg"
                  className="mt-4"
                  icon={<Pencil size={16} color="#FFFFFF" />}
                  onPress={() => void openEdit(selected)}
                />
              ) : null}
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Create / edit company */}
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
                    {formRow ? 'Edit company' : 'Add company'}
                  </Text>
                  <Text className="font-lato text-xs text-neutral-600 mt-0.5">
                    {formRow ? formRow.name : 'Company and primary contact'}
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
                {formLoading ? (
                  <View className="items-center py-8">
                    <ActivityIndicator color="#5279AC" />
                  </View>
                ) : (
                  <>
                    <TextField
                      label="Company name"
                      required
                      value={form.name}
                      onChangeText={value => setField('name', value)}
                    />
                    <SelectField
                      label="Category"
                      placeholder="Select category"
                      value={form.category_id || undefined}
                      options={options.categories}
                      onChange={value => setField('category_id', value)}
                      searchable
                    />
                    <SelectField
                      label="Country"
                      placeholder="Select country"
                      value={form.country_id || undefined}
                      options={options.countries}
                      onChange={value => setField('country_id', value)}
                      searchable
                    />
                    <TextField
                      label="City ID"
                      placeholder="e.g. 12"
                      value={form.city_id}
                      onChangeText={value => setField('city_id', value)}
                      keyboardType="numeric"
                    />

                    <Text className="font-lato-bold text-[10px] uppercase tracking-[1px] text-neutral-600 mt-2 mb-1">
                      Primary contact
                    </Text>
                    <TextField
                      label="Contact name"
                      value={form.con_p_name}
                      onChangeText={value => setField('con_p_name', value)}
                    />
                    <TextField
                      label="Designation"
                      value={form.con_desgnation}
                      onChangeText={value =>
                        setField('con_desgnation', value)
                      }
                    />
                    <TextField
                      label="Contact email"
                      value={form.con_email}
                      onChangeText={value => setField('con_email', value)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <TextField
                      label="Contact phone"
                      value={form.con_mobilenumber}
                      onChangeText={value =>
                        setField('con_mobilenumber', value)
                      }
                      keyboardType="phone-pad"
                    />
                  </>
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
                  title={formRow ? 'Save changes' : 'Add company'}
                  size="lg"
                  className="flex-1"
                  loading={formSaving}
                  disabled={formLoading}
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

/** Only overwrite fields the edit endpoint actually returned. */
function mapEditValues(values: Record<string, string>): Partial<CompanyForm> {
  const next: Partial<CompanyForm> = {};
  const name = values.name || values.co_name;
  if (name) {
    next.name = name;
  }
  for (const key of [
    'category_id',
    'country_id',
    'city_id',
    'con_p_name',
    'con_desgnation',
    'con_email',
    'con_mobilenumber',
  ] as const) {
    if (values[key]) {
      next[key] = values[key];
    }
  }
  return next;
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
