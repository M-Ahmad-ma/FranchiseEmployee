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
  CalendarDays,
  ClipboardList,
  Plus,
  UserRound,
  X,
} from 'lucide-react-native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { AlertBanner } from '../../shared/components/AlertBanner';
import { Badge } from '../../shared/components/Badge';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { DateField } from '../../shared/components/DateField';
import { DetailRow, DetailSection } from '../../shared/components/RecordDetails';
import { TextField } from '../../shared/components/TextField';
import { useAuth } from '../../navigation/AuthContext';
import { P } from '../../services/permissions';
import {
  createReport,
  fetchReports,
  type ModuleRow,
} from '../../services/moduleService';
import { describeApiError } from '../../services/httpClient';
import { pickString, toApiDate } from '../../services/utils';

interface ReportMetric {
  key: string;
  label: string;
}

const METRICS: ReportMetric[] = [
  { key: 'rep_calls', label: 'Calls' },
  { key: 'rep_emails', label: 'Emails' },
  { key: 'rep_meetings', label: 'Meetings' },
  { key: 'rep_whatsup', label: 'WhatsApp' },
  { key: 'rep_sms', label: 'SMS' },
  { key: 'rep_franchiseshow', label: 'Franchise shows' },
  { key: 'rep_franchisedeal', label: 'Franchise deals' },
  { key: 'rep_searchedbrand', label: 'Brands searched' },
  { key: 'rep_addedbrand', label: 'Brands added' },
  { key: 'rep_meetingbrand', label: 'Brand meetings' },
  { key: 'rep_signup', label: 'Sign-ups' },
  { key: 'rep_addedcompany', label: 'Companies added' },
  { key: 'rep_mou', label: 'MOUs' },
  { key: 'rep_addedproperty', label: 'Properties added' },
  { key: 'rep_resale', label: 'Resale' },
  { key: 'rep_addedjobs', label: 'Jobs added' },
  { key: 'rep_revenu', label: 'Revenue' },
  { key: 'rep_attendmeetig', label: 'Meetings attended' },
  { key: 'rep_packets', label: 'Packets' },
];

interface ReportRecord {
  id: string;
  employee: string;
  employeeId: string;
  date: string;
  submitted: string;
  status: string;
  description: string;
  metrics: Array<{ label: string; value: string }>;
  raw: Record<string, unknown>;
}

function normalizeReport(row: ModuleRow): ReportRecord {
  const raw = row.raw;
  return {
    id: row.id || pickString(raw, ['rep_id', 'report_id', 'r_id', 'id']),
    employee: pickString(raw, ['emp_name', 'employee_name']) || row.title,
    employeeId: pickString(raw, ['emp_id', 'employee_id']),
    date: pickString(raw, ['rep_date', 'date']),
    submitted: pickString(raw, ['rep_submitdate', 'submitted_at']),
    status: pickString(raw, ['rep_status', 'status']),
    description: pickString(raw, ['rep_desc', 'description']),
    metrics: METRICS.map(metric => ({
      label: metric.label,
      value: pickString(raw, [metric.key]),
    })).filter(metric => metric.value !== ''),
    raw,
  };
}

function statusLabel(status: string): string {
  if (status === '1') {
    return 'Submitted';
  }
  if (status === '0') {
    return 'Draft';
  }
  return status || 'Unknown';
}

function formatDate(value: string): string {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return value || '—';
  }
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatSubmitted(value: string): string {
  if (!value || value.startsWith('0000-00-00')) {
    return 'Not submitted';
  }
  return value;
}

function reportSummary(report: ReportRecord): Array<{
  label: string;
  value: string;
}> {
  const preferred = ['Calls', 'Emails', 'Meetings', 'Revenue'];
  return report.metrics
    .filter(metric => preferred.includes(metric.label))
    .slice(0, 4);
}

interface ReportForm {
  date: string;
  description: string;
  metrics: Record<string, string>;
}

const FORM_METRICS = [
  'rep_calls',
  'rep_emails',
  'rep_meetings',
  'rep_whatsup',
  'rep_sms',
  'rep_addedbrand',
  'rep_addedcompany',
  'rep_addedproperty',
  'rep_addedjobs',
  'rep_franchisedeal',
  'rep_revenu',
];

function emptyForm(): ReportForm {
  const metrics: Record<string, string> = {};
  for (const key of FORM_METRICS) {
    metrics[key] = '';
  }
  return { date: '', description: '', metrics };
}

export function ReportsScreen() {
  const { can } = useAuth();
  const canCreate = can(P.reportsAdd);

  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ReportRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ReportForm>(emptyForm);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchReports(force));
      setVisibleCount(20);
    } catch (loadError) {
      setRows([]);
      setError(describeApiError(loadError, 'Could not load reports.'));
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

  const reports = useMemo(() => rows.map(normalizeReport), [rows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return reports;
    }
    return reports.filter(report =>
      [
        report.employee,
        report.description,
        report.date,
        statusLabel(report.status),
        ...report.metrics.map(metric => `${metric.label} ${metric.value}`),
      ]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [query, reports]);

  const openCreate = () => {
    setForm(emptyForm());
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (formSaving) {
      return;
    }
    setFormOpen(false);
    setFormError(null);
  };

  const submit = async () => {
    const date = toApiDate(form.date);
    if (!date) {
      setFormError('Pick a valid report date.');
      return;
    }
    if (!form.description.trim()) {
      setFormError('Add a short report description.');
      return;
    }

    const payload: Record<string, string> = {
      rep_date: date,
      rep_desc: form.description.trim(),
    };
    for (const [key, value] of Object.entries(form.metrics)) {
      if (value.trim()) {
        payload[key] = value.trim();
      }
    }

    setFormSaving(true);
    setFormError(null);
    try {
      await createReport(payload);
      setFormOpen(false);
      await load(true);
    } catch (saveError) {
      setFormError(describeApiError(saveError, 'Could not add this report.'));
    } finally {
      setFormSaving(false);
    }
  };

  return (
    <DashboardLayout
      title="Reports"
      subtitle="Daily team activity reports"
      showMenu
      onRefresh={refresh}
      refreshing={pullRefreshing}>
      <Card className="bg-white rounded-2xl p-4 mb-4">
        <TextField
          label="Search reports"
          placeholder="Employee, date, description or activity"
          value={query}
          onChangeText={value => {
            setQuery(value);
            setVisibleCount(20);
          }}
        />
        <Badge
          label={`${filtered.length} of ${reports.length} report${reports.length === 1 ? '' : 's'
            }`}
        />
      </Card>

      <View className="flex-row items-center justify-between gap-3 mb-4">
        <Badge label={`${filtered.length} shown`} tone="neutral" />
        {canCreate ? (
          <Button
            title="Add report"
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
            reports.length === 0
              ? 'No reports found.'
              : 'No reports match that search.'
          }
        />
      ) : (
        <View style={{ opacity: loading ? 0.55 : 1 }}>
          {filtered.slice(0, visibleCount).map(report => {
            const summary = reportSummary(report);
            return (
              <Card
                key={report.id || `${report.employee}-${report.date}`}
                className="bg-white rounded-2xl p-4 mb-3">
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setSelected(report)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open report by ${report.employee}`}>
                  <View className="flex-row items-start gap-3">
                    <View className="w-10 h-10 rounded-xl bg-primary-200 items-center justify-center">
                      <ClipboardList size={17} color="#5279AC" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-lato-bold text-base text-neutral-900">
                        {report.employee || 'Report'}
                      </Text>
                      <Text className="font-lato text-xs text-neutral-600 mt-1">
                        {formatDate(report.date)}
                      </Text>
                    </View>
                    <Badge
                      label={statusLabel(report.status)}
                      tone={report.status === '1' ? 'success' : 'neutral'}
                    />
                  </View>

                  {summary.length > 0 ? (
                    <View className="flex-row flex-wrap gap-2 mt-3">
                      {summary.map(metric => (
                        <View
                          key={metric.label}
                          className="bg-primary-200 rounded-full px-2.5 py-1">
                          <Text className="font-lato text-[11px] text-primary-700">
                            {metric.label}: {metric.value}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {report.description ? (
                    <Text
                      className="font-lato text-xs text-neutral-600 mt-3 leading-5"
                      numberOfLines={2}>
                      {report.description}
                    </Text>
                  ) : null}
                </TouchableOpacity>

                <View className="flex-row justify-end mt-3 pt-3 border-t border-neutral-200">
                  <Button
                    title="View report"
                    size="sm"
                    variant="secondary"
                    onPress={() => setSelected(report)}
                  />
                </View>
              </Card>
            );
          })}
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
                    {selected.employee || 'Report'}
                  </Text>
                  <Text className="font-lato text-xs text-neutral-600 mt-1">
                    Report #{selected.id} · {formatDate(selected.date)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelected(null)}
                  className="w-9 h-9 rounded-full bg-neutral-200 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Close report details">
                  <X size={16} color="#6F778E" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  <Badge
                    label={statusLabel(selected.status)}
                    tone={selected.status === '1' ? 'success' : 'neutral'}
                  />
                  <Badge label={formatDate(selected.date)} tone="primary" />
                </View>

                <DetailSection title="Report">
                  <DetailRow
                    icon={<UserRound size={15} color="#5279AC" />}
                    label="Employee"
                    value={selected.employee || '—'}
                  />
                  <DetailRow
                    icon={<CalendarDays size={15} color="#5279AC" />}
                    label="Date"
                    value={formatDate(selected.date)}
                  />
                  <DetailRow
                    icon={<CalendarDays size={15} color="#5279AC" />}
                    label="Submitted"
                    value={formatSubmitted(selected.submitted)}
                  />

                </DetailSection>

                {selected.description ? (
                  <View className="pb-3 border-b border-neutral-200">
                    <Text className="font-lato-bold text-xs text-neutral-600 mb-1.5">
                      Description
                    </Text>
                    <Text className="font-lato text-sm text-neutral-900 leading-5">
                      {selected.description}
                    </Text>
                  </View>
                ) : null}

                {selected.metrics.length > 0 ? (
                  <View className="pt-3">
                    <Text className="font-lato-bold text-[10px] uppercase tracking-[1px] text-neutral-600 mb-2">
                      Daily activity
                    </Text>
                    <View className="flex-row flex-wrap justify-between">
                      {selected.metrics.map(metric => (
                        <View
                          key={metric.label}
                          className="bg-neutral-100 rounded-2xl px-3 py-2.5 mb-2"
                          style={{ width: '48%' }}>
                          <Text className="font-lato text-[10px] uppercase tracking-[1px] text-neutral-600">
                            {metric.label}
                          </Text>
                          <Text
                            className="font-lato-black text-lg text-neutral-900 mt-1"
                            numberOfLines={2}>
                            {metric.value}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}

      {formOpen ? (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={closeForm}>
          <View className="flex-1 bg-black/40 justify-end">
            <View className="bg-white rounded-t-3xl max-h-[92%]">
              <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
                <Text className="font-lato-black text-lg text-neutral-900">
                  Add daily report
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
                <DateField
                  label="Report date"
                  required
                  value={form.date}
                  onChange={value =>
                    setForm(current => ({ ...current, date: value }))
                  }
                />
                <TextField
                  label="Description"
                  required
                  value={form.description}
                  onChangeText={value =>
                    setForm(current => ({ ...current, description: value }))
                  }
                  multiline
                />

                <Text className="font-lato-bold text-[10px] uppercase tracking-[1px] text-neutral-600 mt-2 mb-2">
                  Daily activity
                </Text>
                {METRICS.filter(metric =>
                  FORM_METRICS.includes(metric.key),
                ).map(metric => (
                  <TextField
                    key={metric.key}
                    label={metric.label}
                    value={form.metrics[metric.key] ?? ''}
                    onChangeText={value =>
                      setForm(current => ({
                        ...current,
                        metrics: {
                          ...current.metrics,
                          [metric.key]: value,
                        },
                      }))
                    }
                  />
                ))}

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
                  title="Add report"
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
