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
  withMeetings,
  withPipelineNames,
  type LeadFilterDropdowns,
  type LeadFilterParams,
  type LeadFilterRow,
  type LeadRowWithMeetings,
} from '../../services/leadsFilterService';
import {
  fetchAllMeetings,
  type Meeting,
} from '../../services/meetingService';
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

/** `17 Oct` from a `YYYY-MM-DD` meeting date. */
const meetingDay = (value: string) => {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
};

const columns: TableColumn<LeadRowWithMeetings>[] = [
  { key: 'investor', title: 'Investor', width: 150 },
  { key: 'phone', title: 'Phone', width: 130 },
  { key: 'city', title: 'City', width: 110 },
  { key: 'brand', title: 'Brand', width: 120 },
  {
    key: 'meetingType',
    title: 'Type',
    width: 100,
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
    key: 'nextMeeting',
    title: 'Meeting',
    width: 165,
    render: row => {
      const meeting = row.nextMeeting;
      if (!meeting) {
        return (
          <Text className="font-lato text-sm text-neutral-400">None</Text>
        );
      }

      // Mirrors pickPrimary: only an explicit "0" counts as closed, so an
      // unrecognised status reads as still scheduled rather than done.
      const open = meeting.status !== '0';

      // The type is the lead's `meeting_type`, not a field on the meeting row —
      // `/meetings` documents none. So filtering by "Video Call" and seeing
      // "Video Call" here is the same value the Type column shows.
      const parts = [meetingDay(meeting.date), meetingTypeLabel(row.meetingType)];
      if (!open) {
        parts.push('Done');
      }

      return (
        <View className="flex-row items-center gap-1.5">
          <View
            className={`rounded-full px-2 py-1 self-start ${
              open ? 'bg-amber-100' : 'bg-neutral-200'
            }`}>
            <Text
              className={`font-lato-bold text-[11px] ${
                open ? 'text-amber-800' : 'text-neutral-600'
              }`}
              numberOfLines={1}>
              {parts.filter(Boolean).join(' · ')}
            </Text>
          </View>
          {row.meetingCount > 1 ? (
            <Text className="font-lato-bold text-[11px] text-neutral-500">
              +{row.meetingCount - 1}
            </Text>
          ) : null}
        </View>
      );
    },
  },
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
  // Starts false so the first paint is not three spinners over an empty form;
  // the fetch begins on focus and the fields show their spinner from there.
  const [dropdownsLoading, setDropdownsLoading] = useState(false);
  const [rows, setRows] = useState<LeadRowWithMeetings[]>([]);
  const [meta, setMeta] = useState<PageMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Tracks the pull gesture only. `loading` also covers the first paint and the
   * filter buttons, and feeding that to the RefreshControl made its spinner spin
   * on top of the button and table loaders — three indicators for one request.
   */
  const [pullRefreshing, setPullRefreshing] = useState(false);

  /**
   * `loading` spans every fetch, including the one on mount. This is narrower:
   * it is set only when the user asked for rows via a control, so the Apply
   * button's spinner reflects their own action rather than the screen warming up.
   */
  const [actionLoading, setActionLoading] = useState(false);

  const [dropdownsFailed, setDropdownsFailed] = useState(false);

  // `/meetings` has no lead filter, so the whole set is fetched once and joined
  // client-side. Both statuses are needed to tell a scheduled meeting from one
  // that already happened.
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingsFailed, setMeetingsFailed] = useState(false);

  const loadMeetings = useCallback(async () => {
    setMeetingsFailed(false);
    try {
      setMeetings(await fetchAllMeetings());
    } catch {
      // Non-fatal: the leads list and every filter still work, and the Meeting
      // column falls back to "None". Reported so the empty column isn't read as
      // "these leads have no meetings".
      setMeetingsFailed(true);
    }
  }, []);

  const loadDropdowns = useCallback(async () => {
    setDropdownsLoading(true);
    setDropdownsFailed(false);
    try {
      setDropdowns(await fetchLeadFilterDropdowns());
    } catch {
      // The list and the filters still work without pickers, so this is not a
      // page-level error — but the three fields need to say why they are empty
      // rather than looking unpopulated by accident.
      setDropdownsFailed(true);
    } finally {
      setDropdownsLoading(false);
    }
  }, []);

  const load = useCallback(
    async (fromUser = false) => {
      if (fromUser) {
        setActionLoading(true);
      }
      setLoading(true);
      setError(null);
      try {
        const { data, meta: nextMeta } = await fetchFilteredLeads({
          ...filters,
          page,
          perPage: Number(perPage) || 10,
        });
        setMeta(nextMeta);
        setRows(
          withMeetings(
            withPipelineNames(data.leads, dropdowns.pipelineStatuses),
            meetings,
          ),
        );
      } catch {
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
        setActionLoading(false);
      }
    },
    [dropdowns.pipelineStatuses, filters, meetings, page, perPage],
  );

  useFocusEffect(
    useCallback(() => {
      void loadDropdowns();
      void loadMeetings();
    }, [loadDropdowns, loadMeetings]),
  );

  // Meetings arrive on their own schedule, independent of the filtered page, so
  // the rows are re-joined once they land rather than waiting for a refetch.
  useEffect(() => {
    if (meetings.length > 0) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetings]);

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
    void load(true);
  };

  /**
   * Pull-to-refresh is a full refresh: the rows and the two lookup lists, since
   * all three can go stale while the screen sits open.
   */
  const refreshAll = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([load(), loadDropdowns(), loadMeetings()]);
    } finally {
      setPullRefreshing(false);
    }
  }, [load, loadDropdowns, loadMeetings]);


  return (
    <DashboardLayout
      title="Lead Requests"
      subtitle="Filter leads requests by various criteria"
      showMenu
      onRefresh={refreshAll}
      refreshing={pullRefreshing}>
      {/* ---------- Filters ---------- */}
      <Card className="bg-white rounded-2xl p-4">
        <View className="flex-row items-center justify-between gap-2 mb-4">
          <View className="flex-row items-center gap-2">
            <Filter size={18} color="#5279AC" />
            <Text className="font-lato-bold text-lg text-neutral-900">
              Filters
            </Text>
          </View>
          {dropdownsLoading ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" color="#8990A8" />
              <Text className="font-lato text-xs text-neutral-500">
                Loading options
              </Text>
            </View>
          ) : null}
        </View>

        {/* Covers all three pickers at once, so the reason they are empty is
            stated in one place rather than inferred from three empty fields. */}
        {dropdownsFailed ? (
          <View className="mb-4">
            <AlertBanner message="Could not load filter options. Pull to refresh to try again." />
          </View>
        ) : null}

        <View className="flex-row flex-wrap gap-4">
          <SelectField
            label="City"
            placeholder="Select City"
            value={filters.city}
            options={dropdowns.cities}
            onChange={v => setFilter('city', v)}
            style={fieldStyle}
            loading={dropdownsLoading}
            searchable
            searchPlaceholder="Search cities"
          />
          <SelectField
            label="Brand"
            placeholder="Select Brand"
            value={filters.brand}
            options={dropdowns.companies}
            onChange={v => setFilter('brand', v)}
            style={fieldStyle}
            loading={dropdownsLoading}
            searchable
            searchPlaceholder="Search brands"
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
            placeholder="All Statuses"
            value={filters.pipeline}
            options={pipelineOptions}
            onChange={v => setFilter('pipeline', v)}
            style={fieldStyle}
            loading={dropdownsLoading}
            searchable
            searchPlaceholder="Search statuses"
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
            loading={actionLoading}
            icon={<Filter size={16} color="#FFFFFF" />}
            onPress={() => {
              setPage(1);
              void load(true);
            }}
          />
          <Button
            title="Reset"
            size="lg"
            variant="secondary"
            className="flex-1"
            disabled={actionLoading}
            icon={<RefreshCw size={16} color="#FFFFFF" />}
            onPress={() => {
              resetFilters();
              void load(true);
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
            label={`Filtered Requests: ${
              loading && rows.length === 0 ? '—' : meta.total
            }`}
            tone="primary"
          />
        </View>

        <View className="px-4 pb-4">
          {/* Scoped to this table only: the leads and the filters above are
              unaffected, but a column of "None" would otherwise read as fact. */}
          {meetingsFailed ? (
            <View className="mb-3">
              <AlertBanner message="Could not load meetings. The Meeting column is unavailable." />
            </View>
          ) : null}

          {/* Only the first load blanks the table. A reload keeps the rows on
              screen — they are stale, not absent, and replacing them with a
              spinner reads as "no results" and loses the user's place. */}
          {rows.length === 0 ? (
            loading ? (
              <View className="items-center py-8">
                <ActivityIndicator size="large" color="#5279AC" />
              </View>
            ) : (
              <AlertBanner message="No requests found for this filter." />
            )
          ) : (
            <View
              style={{ opacity: loading ? 0.55 : 1 }}
              accessibilityState={{ busy: loading }}>
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
                    e_co_id: row.e_co_id,
                  })
                }
              />
            </View>
          )}
        </View>

        <Pagination meta={meta} onChange={changePage} disabled={loading} />
      </Card>
    </DashboardLayout>
  );
}
