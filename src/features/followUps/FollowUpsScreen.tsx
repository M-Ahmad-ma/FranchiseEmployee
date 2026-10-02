import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Card } from '../../shared/components/Card';
import { DataTable, type TableColumn } from '../../shared/components/DataTable';
import { TabGroup, type TabItem } from '../../shared/components/TabGroup';
import {
  fetchFollowUps,
  type FollowUpRow,
  type FollowUpTab,
} from '../../services/followUpsService';

const TABS: TabItem[] = [
  { key: 'active', label: 'Active (Due/Overdue)' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'done', label: 'Done' },
  { key: 'all', label: 'All' },
];

const statusClass: Record<FollowUpRow['status'], string> = {
  Due: 'bg-secondary-200 text-secondary-700',
  Overdue: 'bg-neutral-200 text-red-500',
  Upcoming: 'bg-primary-200 text-primary-700',
  Done: 'bg-[#BEFFDB] text-[#00A572]',
};

const columns: TableColumn<FollowUpRow>[] = [
  { key: 'date', title: 'Date', width: 110 },
  { key: 'time', title: 'Time', width: 90 },
  { key: 'lead', title: 'Lead', width: 140 },
  { key: 'phone', title: 'Phone', width: 140 },
  { key: 'comment', title: 'Comment', width: 200 },
  {
    key: 'status',
    title: 'Status',
    width: 120,
    render: row => (
      <View
        className={`rounded-full px-3 py-1 ${statusClass[row.status]}`}>
        <Text className="font-lato-bold text-[11px]">{row.status}</Text>
      </View>
    ),
  },
  {
    key: 'action',
    title: 'Action',
    width: 90,
    align: 'right',
    render: () => <MoreHorizontal size={18} color="#8990A8" />,
  },
];

export function FollowUpsScreen() {
  const [tab, setTab] = useState<FollowUpTab>('active');
  const [rows, setRows] = useState<FollowUpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (activeTab: FollowUpTab) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFollowUps(activeTab);
      setRows(result);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  return (
    <DashboardLayout
      title="Follow-ups"
      subtitle="scheduled lead follow-ups"
      breadcrumbs={[{ label: 'Home' }, { label: 'Follow-ups' }]}>
      <TabGroup
        tabs={TABS}
        value={tab}
        onChange={key => setTab(key as FollowUpTab)}
      />

      {error && (
        <Text className="text-red-500 text-sm font-lato mb-3 text-center">
          {error}
        </Text>
      )}

      <Card className="bg-white rounded-2xl overflow-hidden">
        {loading ? (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="#5279AC" />
          </View>
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            emptyMessage="No follow-ups found."
          />
        )}
      </Card>
    </DashboardLayout>
  );
}
