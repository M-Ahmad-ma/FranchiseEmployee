import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Filter, RefreshCw } from 'lucide-react-native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { AlertBanner } from '../../shared/components/AlertBanner';
import { Badge } from '../../shared/components/Badge';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { DataTable, type TableColumn } from '../../shared/components/DataTable';
import { DateField } from '../../shared/components/DateField';
import { Pagination } from '../../shared/components/Pagination';
import { SelectField } from '../../shared/components/SelectField';
import { TextField } from '../../shared/components/TextField';
import { useGrid } from '../../shared/hooks/useGrid';
import {
  dealDoneLabel,
  fetchFilteredLeads,
  fetchLeadFilterDropdowns,
  meetingTypeLabel,
  withPipelineNames,
  type LeadFilterDropdowns,
  type LeadFilterParams,
  type LeadFilterRow,
} from '../../services/leadsFilterService';
import {
  DEALS_DONE_OPTIONS,
  MEETING_TYPE_OPTIONS,
  RECORDS_PER_PAGE_OPTIONS,
} from '../../services/options';
import type { RootStackParamList } from '../../navigation/types';
import type { PageMeta } from '../../services/httpClient';

const EMPTY_DROPDOWNS: LeadFilterDropdowns = {
  cities: [],
  companies: [],
  pipelineStatuses: [],
};

const EMPTY_META: PageMeta = { total: 0, page: 1, per_page: 10, pages: 1 };

const HELPER_TEXT =
  'Filters and pagination run on the server, so the count below is every lead matching your criteria — not just this page.';

const columns: TableColumn<LeadFilterRow>[] = [
  { key: 'investor', title: 'Investor', width: 150 },
  { key: 'phone', title: 'Phone', width: 130 },
  { key: 'city', title: 'City', width: 110 },
  { key: 'brand', title: 'Brand', width: 120 },
  {
    key: 'meetingType',
    title: 'Meeting',
    width: 110,
    render: row => (
      <Text className="font-lato text-sm text-neutral-900">
        {meetingTypeLabel(row.meetingType) || '—'}
      </Text>
    ),
  },
  {
    key: 'dealDone',
    title: 'Deal',
    width: 90,
    render: row => (
      <Text className="font-lato text-sm text-neutral-900">
        {dealDoneLabel(row.dealDone) || '—'}
      </Text>
    ),
  },
  { key: 'date', title: 'Date', width: 110 },
  {
    key: 'pipelineLabel',
    title: 'Status',
    width: 130,
    render: row => (
      <View className="rounded-full bg-primary-200 px-3 py-1 self-start">
        <Text className="font-lato-bold text-[11px] text-primary-700">
          {row.pipelineLabel || '—'}
        </Text>
      </View>
    ),
  },
];

export function RequestsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { itemWidth } = useGrid({ inset: 64, gap: 16 });
  const fieldStyle = { width: itemWidth };

  const [filters, setFilters] = useState<LeadFilterParams>({});
  const [perPage, setPerPage] = useState('10');
  const [page, setPage] = useState(1);

  const [dropdowns, setDropdowns] = useState<LeadFilterDropdowns>(EMPTY_DROPDOWNS);
  const [dropdownsLoading, setDropdownsLoading] = useState(true);
  const [rows, setRows] = useState<LeadFilterRow[]>([]);
  const [meta, setMeta] = useState<PageMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDropdowns = useCallback(async () => {
    setDropdownsLoading(true);
    try {
      setDropdowns(await fetchLeadFilterDropdowns());
    } catch {
      // The filter still works without pickers; leave them empty.
    } finally {
      setDropdownsLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, meta: nextMeta } = await fetchFilteredLeads({
        ...filters,
        page,
        perPage: Number(perPage) || 10,
      });
      setMeta(nextMeta);
      setRows(withPipelineNames(data.leads, dropdowns.pipelineStatuses));
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [dropdowns.pipelineStatuses, filters, page, perPage]);

  useFocusEffect(
    useCallback(() => {
      void loadDropdowns();
    }, [loadDropdowns]),
  );

  // Pipeline names arrive with the dropdowns, so re-label once they land.
  useEffect(() => {
    void load();
    // Runs once on mount; every later change goes through Apply or the pager.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pipelineOptions = useMemo(
    () =>
      dropdowns.pipelineStatuses.map(status => ({
        label: status.name,
        value: status.id,
      })),
    [dropdowns.pipelineStatuses],
  );

  const setFilter = <K extends keyof LeadFilterParams>(
    key: K,
    value: string,
  ) => setFilters(prev => ({ ...prev, [key]: value as never }));

  /** Changing a filter invalidates the current page, so Apply starts at page 1. */
  const resetFilters = () => {
    setFilters({});
    setPage(1);
  };

  const changePage = (next: number) => {
    setPage(next);
    void load();
  };

  console.log(filters)

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
            placeholder={dropdownsLoading ? 'Loading cities…' : 'Select City'}
            value={filters.city}
            options={dropdowns.cities}
            onChange={v => setFilter('city', v)}
            style={fieldStyle}
          />
          <SelectField
            label="Brand"
            placeholder={dropdownsLoading ? 'Loading brands…' : 'Select Brand'}
            value={filters.brand}
            options={dropdowns.companies}
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
            value={filters.commentSearch ?? ''}
            onChangeText={v => setFilter('commentSearch', v)}
            style={fieldStyle}
          />
          <SelectField
            label="Deals Done"
            placeholder="Any"
            value={filters.dealDone}
            options={DEALS_DONE_OPTIONS}
            onChange={v => setFilter('dealDone', v)}
            style={fieldStyle}
          />
          <SelectField
            label="Meeting Type"
            placeholder="Any"
            value={filters.meetingType}
            options={MEETING_TYPE_OPTIONS}
            onChange={v => setFilter('meetingType', v)}
            style={fieldStyle}
          />
          <SelectField
            label="Pipeline Status"
            placeholder={
              dropdownsLoading ? 'Loading statuses…' : 'All Statuses'
            }
            value={filters.pipeline}
            options={pipelineOptions}
            onChange={v => setFilter('pipeline', v)}
            style={fieldStyle}
          />
          <DateField
            label="Date From"
            value={filters.startDate}
            onChange={v => setFilter('startDate', v)}
            style={fieldStyle}
          />
          <DateField
            label="Date To"
            value={filters.endDate}
            onChange={v => setFilter('endDate', v)}
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
            onPress={() => {
              setPage(1);
              void load();
            }}
          />
          <Button
            title="Reset"
            size="lg"
            variant="secondary"
            className="flex-1"
            disabled={loading}
            icon={<RefreshCw size={16} color="#FFFFFF" />}
            onPress={() => {
              resetFilters();
              void load();
            }}
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
            placeholder={perPage}
            value={perPage}
            options={RECORDS_PER_PAGE_OPTIONS}
            onChange={v => {
              setPerPage(v);
              setPage(1);
            }}
            modalTitle="Records per page"
          />
          <Badge
            label={`Filtered Requests: ${loading ? '—' : meta.total}`}
            tone="primary"
          />
        </View>

        <View className="px-4 pb-4">
          {loading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color="#5279AC" />
            </View>
          ) : rows.length === 0 ? (
            <AlertBanner message="No requests found for this filter." />
          ) : (
            <DataTable
              columns={columns}
              data={rows}
              emptyMessage="No requests found."
              onPressRow={row =>
                navigation.navigate('LeadDetail', {
                  leadId: row.id,
                  investor: row.investor,
                  phone: row.phone,
                  company: row.brand,
                })
              }
            />
          )}
        </View>

        <Pagination meta={meta} onChange={changePage} disabled={loading} />
      </Card>
    </DashboardLayout>
  );
}
