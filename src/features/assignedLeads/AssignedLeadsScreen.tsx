import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Building2,
  CalendarDays,
  ChevronRight,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  UserRound,
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
  fetchAssignedRequests,
  type ModuleRow,
} from '../../services/moduleService';
import { describeApiError } from '../../services/httpClient';
import { pickString } from '../../services/utils';
import type { RootStackParamList } from '../../navigation/types';

interface AssignedLeadRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  company: string;
  companyId: string;
  officeNumber: string;
  message: string;
  date: string;
  time: string;
  pipeline: string;
  dealDone: string;
  comment: string;
  commentBy: string;
  commentDate: string;
  meetingStatus: string;
  meetingType: string;
  investorStatus: string;
  employeeId: string;
  leadName: string;
  leadType: string;
  raw: Record<string, unknown>;
}

function normalizeAssignedLead(row: ModuleRow): AssignedLeadRecord {
  const raw = row.raw;
  const first = pickString(raw, ['e_firstname', 'firstname']);
  const last = pickString(raw, ['e_lastname', 'lastname']);
  return {
    id: row.id || pickString(raw, ['e_id', 'lead_id', 'id']),
    name:
      [first, last].filter(Boolean).join(' ').trim() ||
      row.title ||
      'Assigned lead',
    email: pickString(raw, ['e_emailaddress', 'email']),
    phone: pickString(raw, ['e_phonenumber', 'phone', 'contact']),
    city: pickString(raw, ['city_name', 'name', 'e_city']),
    company: pickString(raw, ['co_name', 'company_name', 'company']),
    companyId: pickString(raw, ['e_co_id', 'co_id']),
    officeNumber: pickString(raw, ['co_office_number']),
    message: pickString(raw, ['e_message', 'message']),
    date: pickString(raw, ['e_date', 'date']),
    time: pickString(raw, ['e_time', 'time']),
    pipeline: pickString(raw, ['pipeline']),
    dealDone: pickString(raw, ['deal_done']),
    comment: pickString(raw, ['req_comment', 'comment']),
    commentBy: pickString(raw, ['comment_req_by', 'comment_by']),
    commentDate: pickString(raw, ['comment_date']),
    meetingStatus: pickString(raw, ['meeting_status']),
    meetingType: pickString(raw, ['meeting_type']),
    investorStatus: pickString(raw, ['investor_status']),
    employeeId: pickString(raw, ['employee_id', 'emp_id']),
    leadName: pickString(raw, ['lead_name']),
    leadType: pickString(raw, ['lead_type']),
    raw,
  };
}

function dealLabel(value: string): string {
  if (value === '1') {
    return 'Deal done';
  }
  if (value === '0') {
    return 'Deal open';
  }
  return value || '';
}

function pipelineLabel(value: string): string {
  if (!value || value === '0') {
    return 'New lead';
  }
  return `Stage ${value}`;
}

function initialsFor(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('') || 'L'
  );
}

export function AssignedLeadsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AssignedLeadRecord | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchAssignedRequests(force));
      setVisibleCount(20);
    } catch (loadError) {
      setRows([]);
      setError(describeApiError(loadError, 'Could not load assigned leads.'));
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

  const leads = useMemo(() => rows.map(normalizeAssignedLead), [rows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return leads;
    }
    return leads.filter(lead =>
      [
        lead.name,
        lead.email,
        lead.phone,
        lead.city,
        lead.company,
        lead.message,
        lead.comment,
        lead.leadName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [leads, query]);

  const openLead = (lead: AssignedLeadRecord) => {
    navigation.navigate('LeadDetail', {
      leadId: lead.id,
      investor: lead.name,
      phone: lead.phone,
      company: lead.company,
      e_co_id: lead.companyId || undefined,
    });
  };

  return (
    <DashboardLayout
      title="Assigned Leads"
      subtitle="Leads assigned to you"
      showMenu
      onRefresh={refresh}
      refreshing={pullRefreshing}>
      <Card className="bg-white rounded-2xl p-4 mb-4">
        <TextField
          label="Search assigned leads"
          placeholder="Name, company, phone, city or comment"
          value={query}
          onChangeText={value => {
            setQuery(value);
            setVisibleCount(20);
          }}
        />
        <Badge
          label={`${filtered.length} of ${leads.length} lead${
            leads.length === 1 ? '' : 's'
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
            leads.length === 0
              ? 'No assigned leads found.'
              : 'No leads match that search.'
          }
        />
      ) : (
        <View style={{ opacity: loading ? 0.55 : 1 }}>
          {filtered.slice(0, visibleCount).map((lead, index) => (
            <Card
              key={`${lead.id || 'lead'}-${index}`}
              className="bg-white rounded-2xl p-4 mb-3">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSelected(lead)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${lead.name}`}>
                <View className="flex-row items-start gap-3">
                  <View className="w-10 h-10 rounded-xl bg-primary-200 items-center justify-center">
                    <Text className="font-lato-black text-xs text-primary-800">
                      {initialsFor(lead.name)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-lato-bold text-base text-neutral-900">
                      {lead.name}
                    </Text>
                    <Text className="font-lato text-xs text-neutral-600 mt-1">
                      {[lead.company, lead.city]
                        .filter(Boolean)
                        .join(' · ') || 'Assigned lead'}
                    </Text>
                  </View>
                  <Badge
                    label={pipelineLabel(lead.pipeline)}
                    tone={lead.pipeline === '0' ? 'primary' : 'secondary'}
                  />
                </View>

                <View className="flex-row flex-wrap gap-2 mt-3">
                  {lead.phone ? (
                    <View className="flex-row items-center gap-1 bg-neutral-200 rounded-full px-2.5 py-1">
                      <Phone size={11} color="#565E74" />
                      <Text className="font-lato text-[11px] text-neutral-700">
                        {lead.phone}
                      </Text>
                    </View>
                  ) : null}
                  {lead.email ? (
                    <View className="flex-row items-center gap-1 bg-neutral-200 rounded-full px-2.5 py-1">
                      <Mail size={11} color="#565E74" />
                      <Text
                        className="font-lato text-[11px] text-neutral-700"
                        numberOfLines={1}>
                        {lead.email}
                      </Text>
                    </View>
                  ) : null}
                  {lead.date ? (
                    <View className="flex-row items-center gap-1 bg-neutral-200 rounded-full px-2.5 py-1">
                      <CalendarDays size={11} color="#565E74" />
                      <Text className="font-lato text-[11px] text-neutral-700">
                        {[lead.date, lead.time].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View className="flex-row flex-wrap gap-2 mt-3">
                  {dealLabel(lead.dealDone) ? (
                    <Badge
                      label={dealLabel(lead.dealDone)}
                      tone={lead.dealDone === '1' ? 'success' : 'neutral'}
                    />
                  ) : null}
                  {lead.meetingStatus === '1' ? (
                    <Badge label="Meeting scheduled" tone="primary" />
                  ) : null}
                  {lead.investorStatus === '1' ? (
                    <Badge label="Investor" tone="secondary" />
                  ) : null}
                </View>

                {lead.comment ? (
                  <Text
                    className="font-lato text-xs text-neutral-600 mt-3 leading-5"
                    numberOfLines={2}>
                    {lead.comment}
                  </Text>
                ) : null}
              </TouchableOpacity>

              <View className="flex-row justify-end gap-2 mt-3 pt-3 border-t border-neutral-200">
                <Button
                  title="View lead"
                  size="sm"
                  variant="secondary"
                  onPress={() => setSelected(lead)}
                />
                <Button
                  title="Open full lead"
                  size="sm"
                  variant="outlined"
                  icon={<ChevronRight size={13} color="#5279AC" />}
                  onPress={() => openLead(lead)}
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
                    <Text className="font-lato-black text-base text-primary-800">
                      {initialsFor(selected.name)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-lato-black text-lg text-neutral-900">
                      {selected.name}
                    </Text>
                    <Text className="font-lato text-xs text-neutral-600 mt-0.5">
                      Lead #{selected.id}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setSelected(null)}
                  className="w-9 h-9 rounded-full bg-neutral-200 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Close lead details">
                  <X size={16} color="#6F778E" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  <Badge
                    label={pipelineLabel(selected.pipeline)}
                    tone={selected.pipeline === '0' ? 'primary' : 'secondary'}
                  />
                  {dealLabel(selected.dealDone) ? (
                    <Badge
                      label={dealLabel(selected.dealDone)}
                      tone={selected.dealDone === '1' ? 'success' : 'neutral'}
                    />
                  ) : null}
                  {selected.meetingStatus === '1' ? (
                    <Badge label="Meeting scheduled" tone="primary" />
                  ) : null}
                  {selected.investorStatus === '1' ? (
                    <Badge label="Investor" tone="secondary" />
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
                    value={selected.phone || '—'}
                  />
                  <DetailRow
                    icon={<MapPin size={15} color="#5279AC" />}
                    label="City"
                    value={selected.city || '—'}
                  />
                </DetailSection>

                <DetailSection title="Company">
                  <DetailRow
                    icon={<Building2 size={15} color="#5279AC" />}
                    label="Name"
                    value={selected.company || '—'}
                  />
                  <DetailRow
                    icon={<Phone size={15} color="#5279AC" />}
                    label="Office"
                    value={selected.officeNumber || '—'}
                  />
                  <DetailRow
                    icon={<Building2 size={15} color="#5279AC" />}
                    label="Company ID"
                    value={selected.companyId || '—'}
                  />
                </DetailSection>

                <DetailSection title="Lead">
                  <DetailRow
                    icon={<UserRound size={15} color="#5279AC" />}
                    label="Assigned"
                    value={selected.employeeId || '—'}
                  />
                  <DetailRow
                    icon={<CalendarDays size={15} color="#5279AC" />}
                    label="Date"
                    value={
                      [selected.date, selected.time]
                        .filter(Boolean)
                        .join(' · ') || '—'
                    }
                  />
                  {selected.leadName ? (
                    <DetailRow
                      icon={<Building2 size={15} color="#5279AC" />}
                      label="Lead name"
                      value={selected.leadName}
                    />
                  ) : null}
                  {selected.leadType ? (
                    <DetailRow
                      icon={<UserRound size={15} color="#5279AC" />}
                      label="Lead type"
                      value={selected.leadType}
                    />
                  ) : null}
                </DetailSection>

                {selected.message ? (
                  <View className="pt-3 border-t border-neutral-200">
                    <Text className="font-lato-bold text-xs text-neutral-600 mb-1.5">
                      Message
                    </Text>
                    <Text className="font-lato text-sm text-neutral-900 leading-5">
                      {selected.message}
                    </Text>
                  </View>
                ) : null}

                {selected.comment ? (
                  <View className="pt-3 mt-3 border-t border-neutral-200">
                    <View className="flex-row items-center gap-1.5 mb-1.5">
                      <MessageSquare size={14} color="#5279AC" />
                      <Text className="font-lato-bold text-xs text-neutral-600">
                        Latest comment
                      </Text>
                    </View>
                    <Text className="font-lato text-sm text-neutral-900 leading-5">
                      {selected.comment}
                    </Text>
                    {selected.commentBy || selected.commentDate ? (
                      <Text className="font-lato text-[11px] text-neutral-500 mt-1">
                        {[selected.commentBy, selected.commentDate]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </ScrollView>

              <Button
                title="Open full lead"
                size="lg"
                className="mt-4"
                icon={<ChevronRight size={16} color="#FFFFFF" />}
                onPress={() => {
                  const lead = selected;
                  setSelected(null);
                  openLead(lead);
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </DashboardLayout>
  );
}
