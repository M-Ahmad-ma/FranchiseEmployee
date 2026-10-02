import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Filter, RefreshCw } from 'lucide-react-native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { AlertBanner } from '../../shared/components/AlertBanner';
import { Badge } from '../../shared/components/Badge';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { DateField } from '../../shared/components/DateField';
import { SelectField } from '../../shared/components/SelectField';
import { TextField } from '../../shared/components/TextField';
import { useGrid } from '../../shared/hooks/useGrid';
import {
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

const HELPER_TEXT =
  "Use the filters above and click 'Apply Filters' — no data loads until you filter.";

export function RequestsScreen() {
  const { itemWidth } = useGrid({ inset: 64, gap: 16 });
  const fieldStyle = { width: itemWidth };

  const [filters, setFilters] = useState<LeadRequestFilters>({});
  const [recordsPerPage, setRecordsPerPage] = useState('10');
  const [rows, setRows] = useState<LeadRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setFilter = (key: keyof LeadRequestFilters, value: string) =>
    setFilters(prev => ({ ...prev, [key]: value }));

  const applyFilters = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRequests(filters);
      setRows(result);
      setApplied(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setFilters({});
    setRows([]);
    setApplied(false);
    setError(null);
  };

  return (
    <DashboardLayout
      title="Filter Leads Requests"
      subtitle="Filter leads requests by various criteria"
      breadcrumbs={[
        { label: 'Home' },
        { label: 'Tables' },
        { label: 'Requests' },
      ]}>
      {/* ---------- Filters ---------- */}
      <Card className="bg-white rounded-2xl p-4">
        <View className="flex-row items-center gap-2 mb-4">
          <Filter size={18} color="#5279AC" />
          <Text className="font-lato-bold text-lg text-neutral-900">Filters</Text>
        </View>

        <View className="flex-row flex-wrap gap-4">
          <SelectField
            label="City"
            placeholder="Select City"
            value={filters.city}
            options={CITY_OPTIONS}
            onChange={v => setFilter('city', v)}
            style={fieldStyle}
          />
          <SelectField
            label="Brand"
            placeholder="Select Brand"
            value={filters.brand}
            options={BRAND_OPTIONS}
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
            options={DEALS_DONE_OPTIONS}
            onChange={v => setFilter('dealsDone', v)}
            style={fieldStyle}
          />
          <SelectField
            label="Meeting Type"
            placeholder="All"
            value={filters.meetingType}
            options={MEETING_TYPE_OPTIONS}
            onChange={v => setFilter('meetingType', v)}
            style={fieldStyle}
          />
          <SelectField
            label="Pipeline Status"
            placeholder="All Statuses"
            value={filters.pipelineStatus}
            options={PIPELINE_STATUS_OPTIONS}
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
            onPress={applyFilters}
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

      {/* ---------- Data table ---------- */}
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
          <Badge label={`Filtered Requests: ${rows.length}`} tone="primary" />
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
          ) : (
            <AlertBanner message="No requests found for this filter." />
          )}
        </View>
      </Card>
    </DashboardLayout>
  );
}
