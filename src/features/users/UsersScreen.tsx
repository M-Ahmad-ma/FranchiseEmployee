import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  UserRound,
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
  fetchUsers,
  updateUser,
  type ModuleRow,
} from '../../services/moduleService';
import { describeApiError } from '../../services/httpClient';
import { IMAGE_BASE, pickString } from '../../services/utils';

/**
 * Users are not a generic directory row: the API returns account flags, payment
 * fields and permission bits that should not be dumped into the UI as "0"/"1".
 * This screen keeps only the readable account data and uses the exact field
 * names `POST /users/:id/update` expects.
 */

interface UserRecord {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  contact: string;
  company: string;
  city: string;
  type: string;
  status: string;
  visibility: string;
  joinedDate: string;
  joinedTime: string;
  bio: string;
  image: string;
  latestNote: string;
  noteBy: string;
  noteDate: string;
  permissionCount: number;
}

function normalizeUser(row: ModuleRow): UserRecord {
  const raw = row.raw;
  const firstName = pickString(raw, ['u_firstname', 'firstname']);
  const lastName = pickString(raw, ['u_lastname', 'lastname']);
  const name =
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    row.title ||
    'Unnamed user';

  const permissionCount = Object.entries(raw).filter(
    ([key, value]) =>
      (key.startsWith('a_') || key === 'company_edit' || key === 'user_edit') &&
      String(value) === '1',
  ).length;

  return {
    id: row.id || pickString(raw, ['u_id', 'user_id', 'id']),
    firstName,
    lastName,
    name,
    email: pickString(raw, ['u_email', 'email']),
    contact: pickString(raw, ['u_contact', 'contact']),
    company: pickString(raw, ['u_company', 'company']),
    city: pickString(raw, ['u_city', 'city']),
    type: pickString(raw, ['u_type', 'user_type']),
    status: pickString(raw, ['status', 'u_status']),
    visibility: pickString(raw, ['visibility']),
    joinedDate: pickString(raw, ['u_date', 'date']),
    joinedTime: pickString(raw, ['u_time', 'time']),
    bio: pickString(raw, ['u_bio', 'bio']),
    image: pickString(raw, ['u_image', 'image']),
    latestNote: pickString(raw, ['comment']),
    noteBy: pickString(raw, ['comment_by']),
    noteDate: pickString(raw, ['comment_date']),
    permissionCount,
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

function visibilityLabel(value: string): string {
  if (value === '1') {
    return 'Visible';
  }
  if (value === '0') {
    return 'Hidden';
  }
  return value || 'Not set';
}

function typeLabel(value: string): string {
  if (!value) {
    return 'User';
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function initialsFor(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('') || 'U'
  );
}

interface UserForm {
  fname: string;
  lname: string;
  User_email: string;
  contact: string;
  company: string;
  bio: string;
  password: string;
}

const EMPTY_FORM: UserForm = {
  fname: '',
  lname: '',
  User_email: '',
  contact: '',
  company: '',
  bio: '',
  password: '',
};

function formFromUser(user: UserRecord): UserForm {
  return {
    fname: user.firstName,
    lname: user.lastName,
    User_email: user.email,
    contact: user.contact,
    company: user.company,
    bio: user.bio,
    password: '',
  };
}

export function UsersScreen() {
  const { can } = useAuth();
  const canEdit = can(P.usersEdit);

  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<UserRecord | null>(null);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchUsers(force);
      setRows(next);
      setVisibleCount(20);
    } catch (loadError) {
      setRows([]);
      setError(describeApiError(loadError, 'Could not load users.'));
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

  const users = useMemo(() => rows.map(normalizeUser), [rows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return users;
    }
    return users.filter(user =>
      [user.name, user.email, user.contact, user.company, user.city]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [query, users]);

  const openEdit = (user: UserRecord) => {
    setEditing(user);
    setForm(formFromUser(user));
    setFormError(null);
    setSelected(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (formSaving) {
      return;
    }
    setFormOpen(false);
    setEditing(null);
    setFormError(null);
  };

  const setField = (key: keyof UserForm, value: string) =>
    setForm(current => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!editing) {
      return;
    }
    if (!form.fname.trim()) {
      setFormError('First name is required.');
      return;
    }
    if (!form.lname.trim()) {
      setFormError('Last name is required.');
      return;
    }
    if (!form.User_email.trim()) {
      setFormError('Email is required.');
      return;
    }
    if (!form.contact.trim()) {
      setFormError('Contact is required.');
      return;
    }

    const payload: Record<string, string> = {
      fname: form.fname.trim(),
      lname: form.lname.trim(),
      User_email: form.User_email.trim(),
      contact: form.contact.trim(),
      company: form.company.trim(),
      bio: form.bio.trim(),
    };
    if (form.password.trim()) {
      payload.password = form.password.trim();
    }

    setFormSaving(true);
    setFormError(null);
    try {
      await updateUser(editing.id, payload);
      setFormOpen(false);
      setEditing(null);
      await load(true);
    } catch (saveError) {
      setFormError(describeApiError(saveError, 'Could not update this user.'));
    } finally {
      setFormSaving(false);
    }

  };

  return (
    <DashboardLayout
      title="Users"
      subtitle="Site users and accounts"
      showMenu
      onRefresh={refresh}
      refreshing={pullRefreshing}>
      <Card className="bg-white rounded-2xl p-4 mb-4">
        <TextField
          label="Search users"
          placeholder="Name, email, phone or company"
          value={query}
          onChangeText={setQuery}
        />
        <View className="flex-row items-center justify-between gap-3">
          <Badge
            label={`${filtered.length} of ${users.length} user${users.length === 1 ? '' : 's'
              }`}
          />
          {loading ? (
            <ActivityIndicator size="small" color="#5279AC" />
          ) : null}
        </View>
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
            users.length === 0
              ? 'No users found.'
              : 'No users match that search.'
          }
        />
      ) : (
        <View style={{ opacity: loading ? 0.55 : 1 }}>
          {filtered.slice(0, visibleCount).map(user => (
            <Card
              key={user.id || user.email || user.name}
              className="bg-white rounded-2xl p-4 mb-3">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSelected(user)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${user.name}`}>
                <View className="flex-row items-center gap-3">
                  <UserAvatar
                    name={user.name}
                    image={user.image}
                    size={44}
                  />
                  <View className="flex-1">
                    <Text className="font-lato-bold text-base text-neutral-900">
                      {user.name}
                    </Text>
                    <Text
                      className="font-lato text-xs text-neutral-600 mt-0.5"
                      numberOfLines={1}>
                      {user.email || 'No email'}
                    </Text>
                  </View>
                  <Badge
                    label={statusLabel(user.status)}
                    tone={user.status === '1' ? 'success' : 'neutral'}
                  />
                </View>

                <View className="flex-row flex-wrap gap-2 mt-3">
                  {user.company ? (
                    <View className="flex-row items-center gap-1 bg-primary-200 rounded-full px-2.5 py-1">
                      <Building2 size={11} color="#5279AC" />
                      <Text className="font-lato text-[11px] text-primary-700">
                        {user.company}
                      </Text>
                    </View>
                  ) : null}
                  {user.contact ? (
                    <View className="flex-row items-center gap-1 bg-neutral-200 rounded-full px-2.5 py-1">
                      <Phone size={11} color="#565E74" />
                      <Text className="font-lato text-[11px] text-neutral-700">
                        {user.contact}
                      </Text>
                    </View>
                  ) : null}
                  {user.city ? (
                    <View className="flex-row items-center gap-1 bg-neutral-200 rounded-full px-2.5 py-1">
                      <MapPin size={11} color="#565E74" />
                      <Text className="font-lato text-[11px] text-neutral-700">
                        {user.city}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>

              <View className="flex-row justify-end gap-2 mt-3 pt-3 border-t border-neutral-200">
                <Button
                  title="View"
                  size="sm"
                  variant="secondary"
                  onPress={() => setSelected(user)}
                />
                {canEdit ? (
                  <Button
                    title="Edit"
                    size="sm"
                    variant="outlined"
                    icon={<Pencil size={13} color="#5279AC" />}
                    onPress={() => openEdit(user)}
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

      {/* Read-only user detail */}
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
                  <UserAvatar
                    name={selected.name}
                    image={selected.image}
                    size={48}
                  />
                  <View className="flex-1">
                    <Text className="font-lato-black text-lg text-neutral-900">
                      {selected.name}
                    </Text>
                    <Text className="font-lato text-xs text-neutral-600 mt-0.5">
                      {selected.email || 'No email'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setSelected(null)}
                  className="w-9 h-9 rounded-full bg-neutral-200 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Close user details">
                  <X size={16} color="#6F778E" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  <Badge
                    label={statusLabel(selected.status)}
                    tone={selected.status === '1' ? 'success' : 'neutral'}
                  />
                  <Badge label={typeLabel(selected.type)} tone="primary" />
                  {selected.company ? (
                    <Badge label={selected.company} tone="secondary" />
                  ) : null}
                </View>

                <DetailSection title="Contact">
                  <DetailRow
                    icon={<Mail size={15} color="#5279AC" />}
                    label="Email"
                    value={selected.email || '—'}
                  />
                  <DetailRow
                    icon={<Phone size={15} color="#5279AC" />}
                    label="Phone"
                    value={selected.contact || '—'}
                  />
                  <DetailRow
                    icon={<Building2 size={15} color="#5279AC" />}
                    label="Company"
                    value={selected.company || '—'}
                  />
                  <DetailRow
                    icon={<MapPin size={15} color="#5279AC" />}
                    label="City"
                    value={selected.city || '—'}
                  />
                </DetailSection>

                <DetailSection title="Account">
                  <DetailRow
                    icon={<UserRound size={15} color="#5279AC" />}
                    label="Status"
                    value={statusLabel(selected.status)}
                  />
                  <DetailRow
                    icon={<ShieldCheck size={15} color="#5279AC" />}
                    label="Visibility"
                    value={visibilityLabel(selected.visibility)}
                  />
                  <DetailRow
                    icon={<CalendarDays size={15} color="#5279AC" />}
                    label="Joined"
                    value={
                      [selected.joinedDate, selected.joinedTime]
                        .filter(Boolean)
                        .join(' · ') || '—'
                    }
                  />
                  <DetailRow
                    icon={<ShieldCheck size={15} color="#5279AC" />}
                    label="Permissions"
                    value={`${selected.permissionCount} enabled`}
                  />
                </DetailSection>

                {selected.bio ? (
                  <View className="pt-3 border-t border-neutral-200">
                    <Text className="font-lato-bold text-xs text-neutral-600 mb-1.5">
                      Bio
                    </Text>
                    <Text className="font-lato text-sm text-neutral-900 leading-5">
                      {selected.bio}
                    </Text>
                  </View>
                ) : null}

                {selected.latestNote ? (
                  <View className="pt-3 mt-3 border-t border-neutral-200">
                    <Text className="font-lato-bold text-xs text-neutral-600 mb-1.5">
                      Latest note
                    </Text>
                    <Text className="font-lato text-sm text-neutral-900 leading-5">
                      {selected.latestNote}
                    </Text>
                    {selected.noteBy || selected.noteDate ? (
                      <Text className="font-lato text-[11px] text-neutral-500 mt-1">
                        {[selected.noteBy, selected.noteDate]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </ScrollView>

              {canEdit ? (
                <Button
                  title="Edit user"
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

      {/* Edit user form */}
      {formOpen && editing ? (
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
                    Edit user
                  </Text>
                  <Text className="font-lato text-xs text-neutral-600 mt-0.5">
                    {editing.name}
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
                  label="First name"
                  required
                  value={form.fname}
                  onChangeText={value => setField('fname', value)}
                />
                <TextField
                  label="Last name"
                  required
                  value={form.lname}
                  onChangeText={value => setField('lname', value)}
                />
                <TextField
                  label="Email"
                  required
                  value={form.User_email}
                  onChangeText={value => setField('User_email', value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextField
                  label="Contact"
                  required
                  value={form.contact}
                  onChangeText={value => setField('contact', value)}
                  keyboardType="phone-pad"
                />
                <TextField
                  label="Company"
                  value={form.company}
                  onChangeText={value => setField('company', value)}
                />
                <TextField
                  label="Bio"
                  value={form.bio}
                  onChangeText={value => setField('bio', value)}
                  multiline
                />
                <TextField
                  label="New password"
                  placeholder="Leave blank to keep the current password"
                  value={form.password}
                  onChangeText={value => setField('password', value)}
                  secureTextEntry
                  autoCapitalize="none"
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
                  variant="primary"
                  className="flex-1"
                  disabled={formSaving}
                  onPress={closeForm}
                />
                <Button
                  title="Save changes"
                  size="lg"
                  variant='secondary'
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

function userImageUrl(image: string): string {
  const trimmed = image.trim();
  if (!trimmed) {
    return '';
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `${IMAGE_BASE.replace(/\/+$/, '')}/${trimmed.replace(/^\/+/, '')}`;
}

/**
 * User avatars come from `u_image`; the API supplies only a filename, so it is
 * resolved against the shared user-image origin. A missing or broken image
 * falls back to initials rather than leaving an empty circle.
 */
function UserAvatar({
  name,
  image,
  size,
}: {
  name: string;
  image: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  const uri = userImageUrl(image);

  useEffect(() => {
    setFailed(false);
  }, [image]);

  const showImage = Boolean(uri) && !failed;

  return (
    <View
      className="bg-primary-200 items-center justify-center overflow-hidden"
      style={{ width: size, height: size, borderRadius: size / 2 }}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={`${name} profile photo`}
        />
      ) : (
        <Text
          className="font-lato-black text-primary-800"
          style={{ fontSize: Math.max(12, Math.round(size * 0.3)) }}>
          {initialsFor(name)}
        </Text>
      )}
    </View>
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
