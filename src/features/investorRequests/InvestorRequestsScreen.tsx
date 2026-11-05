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
  Briefcase,
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
  fetchInvestorRequests,
  type ModuleRow,
} from '../../services/moduleService';
import { describeApiError } from '../../services/httpClient';
import { pickString } from '../../services/utils';
import type { RootStackParamList } from '../../navigation/types';

interface InvestorRequestRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  company: string;
  message: string;
  status: string;
  investorStatus: string;
  submittedAt: string;
  investment: string;
  operation: string;
  place: string;
  timeframe: string;
  leadId: string;
  leadCompanyId: string;
  employeeId: string;
  pipeline: string;
  dealDone: string;
  leadDate: string;
  leadTime: string;
  comment: string;
  commentBy: string;
  commentDate: string;
  meetingStatus: string;
  meetingType: string;
  raw: Record<string, unknown>;
}

function normalizeInvestorRequest(row: ModuleRow): InvestorRequestRecord {
  const raw = row.raw;
  const firstName = pickString(raw, ['req_firstname', 'e_firstname']);
  const lastName = pickString(raw, ['req_lastname', 'e_lastname']);
  return {
    id: row.id || pickString(raw, ['req_id', 'id']),
    name:
      [firstName, lastName].filter(Boolean).join(' ').trim() ||
      row.title ||
      'Investor request',
    email: pickString(raw, [
      'req_emailaddress',
      'e_emailaddress',
      'email',
    ]),
    phone: pickString(raw, [
      'req_phonenumber',
      'e_phonenumber',
      'phone',
      'contact',
    ]),
    city: pickString(raw, ['req_city', 'city_name', 'e_city']),
    company: pickString(raw, ['req_company', 'company_name', 'co_name']),
    message: pickString(raw, ['req_message', 'e_message', 'message']),
    status: pickString(raw, ['req_status', 'status']),
    investorStatus: pickString(raw, ['investor_status']),
    submittedAt: pickString(raw, ['req_time', 'created_at']),
    investment: pickString(raw, ['total_investment', 'investment']),
    operation: pickString(raw, ['operation']),
    place: pickString(raw, ['place']),
    timeframe: pickString(raw, ['time', 'timeframe']),
    leadId: pickString(raw, ['e_id', 'lead_id']),
    leadCompanyId: pickString(raw, ['e_co_id', 'co_id']),
    employeeId: pickString(raw, ['employee_id', 'emp_id']),
    pipeline: pickString(raw, ['pipeline', 'pipeline_name']),
    dealDone: pickString(raw, ['deal_done']),
    leadDate: pickString(raw, ['e_date', 'date']),
    leadTime: pickString(raw, ['e_time', 'time']),
    comment: pickString(raw, ['req_comment', 'comment']),
    commentBy: pickString(raw, ['comment_req_by', 'comment_by']),
    commentDate: pickString(raw, ['comment_date']),
    meetingStatus: pickString(raw, ['meeting_status']),
    meetingType: pickString(raw, ['meeting_type']),
    raw,
  };
}

function statusLabel(status: string): string {
  if (status === '0') {
    return 'New';
  }
  if (status === '1') {
    return 'Reviewed';
  }
  return status || 'Unknown';
}

function investorStatusLabel(status: string): string {
  if (status === '1') {
    return 'Investor';
  }
  if (status === '0') {
    return 'Not investor';
  }
  return '';
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

function initialsFor(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('') || 'I'
  );
}

export function InvestorRequestsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<InvestorRequestRecord | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchInvestorRequests(force));
      setVisibleCount(20);
    } catch (loadError) {
      setRows([]);
      setError(
        describeApiError(loadError, 'Could not load investor requests.'),
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

  const requests = useMemo(
    () => rows.map(normalizeInvestorRequest),
    [rows],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return requests;
    }
    return requests.filter(request =>
      [
        request.name,
        request.email,
        request.phone,
        request.company,
        request.city,
        request.message,
        request.comment,
        request.investment,
        request.operation,
        request.place,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [query, requests]);

  const openLead = (request: InvestorRequestRecord) => {
    if (!request.leadId) {
      return;
    }
    navigation.navigate('LeadDetail', {
      leadId: request.leadId,
      investor: request.name,
      phone: request.phone,
      company: request.company,
      e_co_id: request.leadCompanyId,
    });
  };

  return (
    <DashboardLayout
      title="Investor Requests"
      subtitle="Incoming investor enquiries"
      showMenu
      onRefresh={refresh}
      refreshing={pullRefreshing}>
      <Card className="bg-white rounded-2xl p-4 mb-4">
        <TextField
          label="Search investor requests"
          placeholder="Name, company, city, email or phone"
          value={query}
          onChangeText={value => {
            setQuery(value);
            setVisibleCount(20);
          }}
        />
        <Badge
          label={`${filtered.length} of ${requests.length} request${
            requests.length === 1 ? '' : 's'
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
            requests.length === 0
              ? 'No investor requests found.'
              : 'No investor requests match that search.'
          }
        />
      ) : (
        <View style={{ opacity: loading ? 0.55 : 1 }}>
          {filtered.slice(0, visibleCount).map((request, index) => (
            <Card
              key={`${request.id || 'request'}-${request.leadId || 'lead'}-${index}`}
              className="bg-white rounded-2xl p-4 mb-3">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSelected(request)}
                accessibilityRole="button"
                accessibilityLabel={`Open investor request from ${request.name}`}>
                <View className="flex-row items-start gap-3">
                  <View className="w-10 h-10 rounded-xl bg-primary-200 items-center justify-center">
                    <Text className="font-lato-black text-xs text-primary-800">
                      {initialsFor(request.name)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-lato-bold text-base text-neutral-900">
                      {request.name}
                    </Text>
                    <Text className="font-lato text-xs text-neutral-600 mt-1">
                      {[request.company, request.city]
                        .filter(Boolean)
                        .join(' · ') || 'Investor request'}
                    </Text>
                  </View>
                  <Badge
                    label={statusLabel(request.status)}
                    tone={request.status === '0' ? 'primary' : 'success'}
                  />
                </View>

                <View className="flex-row flex-wrap gap-2 mt-3">
                  {request.phone ? (
                    <View className="flex-row items-center gap-1 bg-neutral-200 rounded-full px-2.5 py-1">
                      <Phone size={11} color="#565E74" />
                      <Text className="font-lato text-[11px] text-neutral-700">
                        {request.phone}
                      </Text>
                    </View>
                  ) : null}
                  {request.email ? (
                    <View className="flex-row items-center gap-1 bg-neutral-200 rounded-full px-2.5 py-1">
                      <Mail size={11} color="#565E74" />
                      <Text
                        className="font-lato text-[11px] text-neutral-700"
                        numberOfLines={1}>
                        {request.email}
                      </Text>
                    </View>
                  ) : null}
                  {request.investment ? (
                    <View className="flex-row items-center gap-1 bg-primary-200 rounded-full px-2.5 py-1">
                      <Briefcase size={11} color="#5279AC" />
                      <Text className="font-lato text-[11px] text-primary-700">
                        {request.investment}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {request.message ? (
                  <Text
                    className="font-lato text-xs text-neutral-600 mt-3 leading-5"
                    numberOfLines={2}>
                    {request.message}
                  </Text>
                ) : null}
              </TouchableOpacity>

              <View className="flex-row justify-end gap-2 mt-3 pt-3 border-t border-neutral-200">
                <Button
                  title="View request"
                  size="sm"
                  variant="secondary"
                  onPress={() => setSelected(request)}
                />
                {request.leadId ? (
                  <Button
                    title="Open lead"
                    size="sm"
                    variant="outlined"
                    icon={<ChevronRight size={13} color="#5279AC" />}
                    onPress={() => openLead(request)}
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
                      Request #{selected.id}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setSelected(null)}
                  className="w-9 h-9 rounded-full bg-neutral-200 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Close investor request details">
                  <X size={16} color="#6F778E" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  <Badge
                    label={statusLabel(selected.status)}
                    tone={selected.status === '0' ? 'primary' : 'success'}
                  />
                  {investorStatusLabel(selected.investorStatus) ? (
                    <Badge
                      label={investorStatusLabel(selected.investorStatus)}
                      tone="secondary"
                    />
                  ) : null}
                  {dealLabel(selected.dealDone) ? (
                    <Badge label={dealLabel(selected.dealDone)} tone="neutral" />
                  ) : null}
                  {selected.meetingStatus === '1' ? (
                    <Badge label="Meeting scheduled" tone="primary" />
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
                  <DetailRow
                    icon={<Building2 size={15} color="#5279AC" />}
                    label="Company"
                    value={selected.company || '—'}
                  />
                </DetailSection>

                <DetailSection title="Request">
                  <DetailRow
                    icon={<CalendarDays size={15} color="#5279AC" />}
                    label="Submitted"
                    value={selected.submittedAt || '—'}
                  />
                  <DetailRow
                    icon={<MessageSquare size={15} color="#5279AC" />}
                    label="Message"
                    value={selected.message || '—'}
                  />
                </DetailSection>

                {selected.investment ||
                selected.operation ||
                selected.place ||
                selected.timeframe ? (
                  <DetailSection title="Investment preferences">
                    {selected.investment ? (
                      <DetailRow
                        icon={<Briefcase size={15} color="#5279AC" />}
                        label="Investment"
                        value={selected.investment}
                      />
                    ) : null}
                    {selected.operation ? (
                      <DetailRow
                        icon={<UserRound size={15} color="#5279AC" />}
                        label="Operation"
                        value={selected.operation}
                      />
                    ) : null}
                    {selected.place ? (
                      <DetailRow
                        icon={<MapPin size={15} color="#5279AC" />}
                        label="Place"
                        value={selected.place}
                      />
                    ) : null}
                    {selected.timeframe ? (
                      <DetailRow
                        icon={<CalendarDays size={15} color="#5279AC" />}
                        label="Timeline"
                        value={selected.timeframe}
                      />
                    ) : null}
                  </DetailSection>
                ) : null}

                <DetailSection title="Lead">
                  <DetailRow
                    icon={<UserRound size={15} color="#5279AC" />}
                    label="Lead ID"
                    value={selected.leadId || '—'}
                  />
                  <DetailRow
                    icon={<UserRound size={15} color="#5279AC" />}
                    label="Assigned"
                    value={selected.employeeId || '—'}
                  />
                  <DetailRow
                    icon={<Briefcase size={15} color="#5279AC" />}
                    label="Pipeline"
                    value={selected.pipeline || '—'}
                  />
                  <DetailRow
                    icon={<CalendarDays size={15} color="#5279AC" />}
                    label="Lead date"
                    value={
                      [selected.leadDate, selected.leadTime]
                        .filter(Boolean)
                        .join(' · ') || '—'
                    }
                  />
                </DetailSection>

                {selected.comment ? (
                  <View className="pt-3 border-t border-neutral-200">
                    <Text className="font-lato-bold text-xs text-neutral-600 mb-1.5">
                      Latest comment
                    </Text>
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

              {selected.leadId ? (
                <Button
                  title="Open lead"
                  size="lg"
                  className="mt-4"
                  icon={<ChevronRight size={16} color="#FFFFFF" />}
                  onPress={() => {
                    const request = selected;
                    setSelected(null);
                    openLead(request);
                  }}
                />
              ) : null}
            </View>
          </View>
        </Modal>
      ) : null}
    </DashboardLayout>
  );
}
