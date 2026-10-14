import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CalendarClock, CheckCircle2 } from 'lucide-react-native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { AlertBanner } from '../../shared/components/AlertBanner';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { DataTable, type TableColumn } from '../../shared/components/DataTable';
import { TabGroup, type TabItem } from '../../shared/components/TabGroup';
import { FollowUpSheet } from './FollowUpSheet';
import {
  fetchFollowups,
  markFollowUpDone,
  type FollowUp,
} from '../../services/followupsService';
import { toApiDate } from '../../services/utils';
import { ApiError } from '../../services/httpClient';
import type { RootStackParamList } from '../../navigation/types';

const STATUS_TABS: TabItem[] = [
  { key: 'active', label: 'Active' },
  { key: 'all', label: 'All' },
];

/** Overdue means still open, and the follow-up date has already passed. */
function isOverdue(followUp: FollowUp) {
  if (followUp.status.toLowerCase() === 'done') {
    return false;
  }
  const iso = toApiDate(followUp.date);
  if (!iso) {
    return false;
  }
  const [year, month, day] = iso.split('-').map(Number);
  // Compared at UTC midnight so the test is date-only, not clock-sensitive.
  const today = new Date();
  return (
    Date.UTC(year, month - 1, day) <
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  );
}

const statusPill = (row: FollowUp) => {
  if (row.status.toLowerCase() === 'done') {
    return { tone: 'bg-[#BEFFDB] text-[#00A572]', label: 'Done' };
  }
  if (isOverdue(row)) {
    return { tone: 'bg-secondary-200 text-secondary-700', label: 'Overdue' };
  }
  return { tone: 'bg-primary-200 text-primary-700', label: 'Active' };
};

export function FollowUpsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [status, setStatus] = useState('active');
  const [rows, setRows] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setRows(await fetchFollowups(status));
    } catch {
      setLoadError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onDone = useCallback(async (id: string) => {
    setNotice(null);
    setPendingId(id);
    try {
      await markFollowUpDone(id);
      // Patch the row in place so the queue updates without a full refetch.
      setRows(current =>
        current.map(row => (row.id === id ? { ...row, status: 'done' } : row)),
      );
    } catch (error) {
      setNotice(
        error instanceof ApiError && error.status === 403
          ? 'That lead belongs to another employee.'
          : 'Could not close the follow-up. Please try again.',
      );
    } finally {
      setPendingId(null);
    }
  }, []);

  const columns: TableColumn<FollowUp>[] = [
    { key: 'investor', title: 'Lead', width: 150 },
    { key: 'phone', title: 'Phone', width: 125 },
    { key: 'company', title: 'Company', width: 115 },
    { key: 'date', title: 'Date', width: 105 },
    { key: 'time', title: 'Time', width: 75 },
    { key: 'comment', title: 'Comment', width: 170 },
    {
      key: 'status',
      title: 'Status',
      width: 105,
      render: row => {
        const pill = statusPill(row);
        return (
          <View className={`rounded-full px-3 py-1 self-start ${pill.tone}`}>
            <Text className="font-lato-bold text-[11px]">{pill.label}</Text>
          </View>
        );
      },
    },
    {
      key: 'action',
      title: 'Action',
      width: 115,
      align: 'right',
      render: row =>
        row.status.toLowerCase() === 'done' ? (
          <Text className="font-lato text-xs text-neutral-500">Closed</Text>
        ) : (
          <Button
            title="Mark done"
            size="sm"
            variant="outlined"
            loading={pendingId === row.id}
            disabled={pendingId !== null}
            icon={<CheckCircle2 size={14} color="#5279AC" />}
            onPress={() => onDone(row.id)}
          />
        ),
    },
  ];

  return (
    <DashboardLayout
      title="Lead Follow-ups"
      subtitle="leads assigned to you"
      showMenu
      onRefresh={load}
      refreshing={loading}>
      <TabGroup tabs={STATUS_TABS} value={status} onChange={setStatus} />

      <View className="flex-row justify-end mb-4">
        <Button
          title="Schedule follow-up"
          size="sm"
          icon={<CalendarClock size={14} color="#FFFFFF" />}
          onPress={() => setScheduling(true)}
        />
      </View>

      {notice && (
        <View className="mb-3">
          <AlertBanner message={notice} />
        </View>
      )}

      {loadError && (
        <Text className="text-red-500 text-sm font-lato mb-3 text-center">
          {loadError}
        </Text>
      )}

      <Card className="bg-white rounded-2xl overflow-hidden">
        {loading ? (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="#5279AC" />
          </View>
        ) : rows.length === 0 ? (
          <View className="px-4 py-6">
            <AlertBanner
              message={
                status === 'active'
                  ? 'No follow-ups are outstanding.'
                  : 'No follow-ups have been scheduled yet.'
              }
            />
          </View>
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            emptyMessage="No follow-ups."
            onPressRow={row =>
              navigation.navigate('LeadDetail', {
                leadId: row.leadId,
                investor: row.investor,
                phone: row.phone,
                company: row.company,
              })
            }
          />
        )}
      </Card>

      <FollowUpSheet
        visible={scheduling}
        onClose={() => setScheduling(false)}
        onScheduled={load}
      />
    </DashboardLayout>
  );
}