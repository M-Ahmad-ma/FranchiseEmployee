import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MoreHorizontal } from 'lucide-react-native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Card } from '../../shared/components/Card';
import { DataTable, type TableColumn } from '../../shared/components/DataTable';
import { TabGroup, type TabItem } from '../../shared/components/TabGroup';
import {
  fetchTasks,
  type TaskRow,
  type TaskStatusFilter,
} from '../../services/tasksService';

type TaskTab = 'open' | 'completed' | 'all';

const TABS: TabItem[] = [
  { key: 'open', label: 'Open' },
  { key: 'completed', label: 'Completed' },
  { key: 'all', label: 'All' },
];

/** The API's `status` filter is the only server-side filter available. */
const STATUS_FOR_TAB: Record<TaskTab, TaskStatusFilter | 'all'> = {
  open: 0,
  completed: 1,
  all: 'all',
};

const stateClass: Record<TaskRow['state'], string> = {
  open: 'bg-secondary-200 text-secondary-700',
  completed: 'bg-[#BEFFDB] text-[#00A572]',
};

const columns: TableColumn<TaskRow>[] = [
  { key: 'title', title: 'Task', width: 220 },
  { key: 'assignedTo', title: 'Assigned To', width: 150 },
  { key: 'comment', title: 'Comment', width: 200 },
  { key: 'date', title: 'Date', width: 120 },
  {
    key: 'state',
    title: 'Status',
    width: 120,
    render: row => (
      <View className={`rounded-full px-3 py-1 ${stateClass[row.state]}`}>
        <Text className="font-lato-bold text-[11px]">
          {row.state === 'open' ? 'Open' : 'Completed'}
        </Text>
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

export function TasksScreen() {
  const [tab, setTab] = useState<TaskTab>('open');
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (activeTab: TaskTab) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchTasks(STATUS_FOR_TAB[activeTab]));
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Depends on `tab`, so this covers the first load, every tab change and every
  // return to this screen — one effect instead of three.
  useFocusEffect(
    useCallback(() => {
      load(tab);
    }, [load, tab]),
  );

  return (
    <DashboardLayout
      title="Tasks"
      subtitle="your assigned tasks"
      showMenu
      onRefresh={() => load(tab)}
      refreshing={loading}>
      <TabGroup
        tabs={TABS}
        value={tab}
        onChange={key => setTab(key as TaskTab)}
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
            emptyMessage="No tasks found."
          />
        )}
      </Card>
    </DashboardLayout>
  );
}
