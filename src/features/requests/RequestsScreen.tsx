import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Filter, RefreshCw } from 'lucide-react-native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { AlertBanner } from '../../shared/components/AlertBanner';
import { Badge } from '../../shared/components/Badge';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { DataTable, type TableColumn } from '../../shared/components/DataTable';
import { DateField } from '../../shared/components/DateField';
import { SelectField } from '../../shared/components/SelectField';
import { TextField } from '../../shared/components/TextField';
import { useGrid } from '../../shared/hooks/useGrid';
import {
  applyRequestFilters,
  fetchRequests,
  type LeadRequestFilters,
  type LeadRequestRow,
} from '../../services/requestsService';
import {
  BRAND_OPTIONS,
  CITY_OPTIONS,
  DEALS_DONE_OPTIONS,
  MEETING_TYPE_OPTIONS,
  PIPELINE_STATUS_OPTIONS,
  RECORDS_PER_PAGE_OPTIONS,
} from '../../services/options';
import type { Option } from '../../services/utils';

const HELPER_TEXT =
  'Leads reload each time you return here, and the filters run on your device — this endpoint has no server-side filtering.';

/**
 * Builds dropdown options from the rows that actually came back, so the filters
 * only ever offer values present in the data and update as it changes. Falls
 * back to the reference lists while loading or when the result set is empty.
 */
function optionsFrom(values: (string | undefined)[], fallback: Option[]) {
  const distinct = Array.from(
    new Set(values.map(value => (value ?? '').trim()).filter(Boolean)),
  )
    .sort((a, b) => a.localeCompare(b))
    .map(value => ({ label: value, value }));

  return distinct.length > 0 ? distinct : fallback;
}

const columns: TableColumn<LeadRequestRow>[] = [
  { key: 'investor', title: 'Investor', width: 150 },
  { key: 'phone', title: 'Phone', width: 130 },
  { key: 'city', title: 'City', width: 110 },
  { key: 'brand', title: 'Brand', width: 110 },
  { key: 'meetingType', title: 'Meeting', width: 110 },
  { key: 'dealsDone', title: 'Deals', width: 100 },
  { key: 'date', title: 'Date', width: 110 },
  {
    key: 'pipelineStatus',
    title: 'Status',
    width: 130,
    render: row => (
      <View className="rounded-full bg-primary-200 px-3 py-1 self-start">
        <Text className="font-lato-bold text-[11px] text-primary-700">
          {row.pipelineStatus || '—'}
        </Text>
      </View>
    ),
  },
];

export function RequestsScreen() {
  const { itemWidth } = useGrid({ inset: 64, gap: 16 });
  const fieldStyle = { width: itemWidth };

  const [filters, setFilters] = useState<LeadRequestFilters>({});
  const [recordsPerPage, setRecordsPerPage] = useState('10');
  const [rows, setRows] = useState<LeadRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchRequests());
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const visibleRows = useMemo(
    () => applyRequestFilters(rows, filters),
    [filters, rows],
  );

  const cityOptions = useMemo(
    () =>
      optionsFrom(
        rows.map(row => row.city),
        CITY_OPTIONS,
      ),
    [rows],
  );
  const brandOptions = useMemo(
    () =>
      optionsFrom(
        rows.map(row => row.brand),
        BRAND_OPTIONS,
      ),
    [rows],
  );
  const meetingTypeOptions = useMemo(
    () =>
      optionsFrom(
        rows.map(row => row.meetingType),
        MEETING_TYPE_OPTIONS,
      ),
    [rows],
  );
  const pipelineStatusOptions = useMemo(
    () =>
      optionsFrom(
        rows.map(row => row.pipelineStatus),
        PIPELINE_STATUS_OPTIONS,
      ),
    [rows],
  );
  const dealsDoneOptions = useMemo(
    () =>
      optionsFrom(
        rows.map(row => row.dealsDone),
        DEALS_DONE_OPTIONS,
      ),
    [rows],
  );

  const setFilter = (key: keyof LeadRequestFilters, value: string) =>
    setFilters(prev => ({ ...prev, [key]: value }));

  const resetFilters = () => {
    setFilters({});
    setApplied(false);
  };

  return (
    <DashboardLayout
      title="Lead Requests"
      subtitle="Filter leads requests by various criteria"
      showMenu
      onRefresh={load}
      refreshing={loading}>
      {/* ---------- Filters ---------- */}
      <Card className="bg-white rounded-2xl p-4">
        <View className="flex-row items-center gap-2 mb-4">
          <Filter size={18} color="#5279AC" />
          <Text className="font-lato-bold text-lg text-neutral-900">
            Filters
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-4">
          <SelectField
            label="City"
            placeholder="Select City"
            value={filters.city}
            options={cityOptions}
            onChange={v => setFilter('city', v)}
            style={fieldStyle}
          />
          <SelectField
            label="Brand"
            placeholder="Select Brand"
            value={filters.brand}
            options={brandOptions}
            onChange={v => setFilter('brand', v)}
            style={fieldStyle}
          />
          <TextField
            label="Investor"
            placeholder="Search by name or phone"
            value={filters.investor ?? ''}
            onChangeText={v => setFilter('investor', v)}
            style={fieldStyle}
          />
          <TextField
            label="Search Comments"
            placeholder="Search comment text"
            value={filters.comments ?? ''}
            onChangeText={v => setFilter('comments', v)}
            style={fieldStyle}
          />
          <SelectField
            label="Deals Done"
            placeholder="Select Deals Done"
            value={filters.dealsDone}
            options={dealsDoneOptions}
            onChange={v => setFilter('dealsDone', v)}
            style={fieldStyle}
          />
          <SelectField
            label="Meeting Type"
            placeholder="All"
            value={filters.meetingType}
            options={meetingTypeOptions}
            onChange={v => setFilter('meetingType', v)}
            style={fieldStyle}
          />
          <SelectField
            label="Pipeline Status"
            placeholder="All Statuses"
            value={filters.pipelineStatus}
            options={pipelineStatusOptions}
            onChange={v => setFilter('pipelineStatus', v)}
            style={fieldStyle}
          />
          <DateField
            label="Date From"
            value={filters.dateFrom}
            onChange={v => setFilter('dateFrom', v)}
            style={fieldStyle}
          />
          <DateField
            label="Date To"
            value={filters.dateTo}
            onChange={v => setFilter('dateTo', v)}
            style={fieldStyle}
          />
        </View>

        <View className="flex-row gap-3 mt-2">
          <Button
            title="Apply Filters"
            size="lg"
            className="flex-1"
            loading={loading}
            icon={<Filter size={16} color="#FFFFFF" />}
            onPress={() => setApplied(true)}
          />
          <Button
            title="Reset"
            size="lg"
            variant="secondary"
            className="flex-1"
            disabled={loading}
            icon={<RefreshCw size={16} color="#FFFFFF" />}
            onPress={resetFilters}
          />
        </View>

        <Text className="text-neutral-700 text-sm font-lato mt-3 leading-5">
          {HELPER_TEXT}
        </Text>

        {error && (
          <Text className="text-red-500 text-sm font-lato mt-3 text-center">
            {error}
          </Text>
        )}
      </Card>

      {/* ---------- Results ---------- */}
      <Card className="bg-white rounded-2xl overflow-hidden mt-6">
        <View className="flex-row items-center justify-between px-4 py-3 gap-3">
          <SelectField
            compact
            prefix="Records per page:"
            placeholder={recordsPerPage}
            value={recordsPerPage}
            options={RECORDS_PER_PAGE_OPTIONS}
            onChange={setRecordsPerPage}
            modalTitle="Records per page"
          />
          <Badge
            label={`Filtered Requests: ${applied ? visibleRows.length : rows.length}`}
            tone="primary"
          />
        </View>

        <View className="px-4 pb-4">
          {loading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color="#5279AC" />
            </View>
          ) : !applied ? (
            <View className="items-center py-8">
              <Text className="text-neutral-600 font-lato text-base leading-6 text-center">
                Apply filters to view requests.
              </Text>
            </View>
          ) : visibleRows.length === 0 ? (
            <AlertBanner message="No requests found for this filter." />
          ) : (
            <DataTable
              columns={columns}
              data={visibleRows.slice(0, Number(recordsPerPage) || 10)}
              emptyMessage="No requests found."
            />
          )}
        </View>
      </Card>
    </DashboardLayout>
  );
}
