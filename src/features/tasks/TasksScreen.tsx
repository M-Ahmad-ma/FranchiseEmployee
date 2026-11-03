import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CheckCircle2, ChevronRight, ClipboardList } from 'lucide-react-native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { AlertBanner } from '../../shared/components/AlertBanner';
import { Badge } from '../../shared/components/Badge';
import { Card } from '../../shared/components/Card';
import { TabGroup, type TabItem } from '../../shared/components/TabGroup';
import { fetchTasks } from '../../services/tasksService';
import { describeApiError } from '../../services/httpClient';
import type { ModuleRow } from '../../services/moduleService';
import type { RootStackParamList } from '../../navigation/types';

const TABS: TabItem[] = [
  { key: '0', label: 'Open' },
  { key: '1', label: 'Completed' },
];

export function TasksScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [status, setStatus] = useState('0');
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchTasks(status));
    } catch (loadError) {
      setRows([]);
      setError(describeApiError(loadError, 'Could not load tasks.'));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await load();
    } finally {
      setPullRefreshing(false);
    }
  }, [load]);

  return (
    <DashboardLayout
      title="Tasks"
      subtitle="Work assigned to you"
      showMenu
      onRefresh={refresh}
      refreshing={pullRefreshing}>
      <TabGroup tabs={TABS} value={status} onChange={setStatus} />

      <View className="flex-row items-center justify-between gap-3 mb-3">
        <Badge
          label={`${rows.length} ${status === '1' ? 'completed' : 'open'} task${rows.length === 1 ? '' : 's'}`}
        />
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
      ) : rows.length === 0 ? (
        <Card className="bg-white rounded-2xl">
          <View className="items-center px-6 py-8">
            <View className="w-14 h-14 rounded-full bg-primary-200 items-center justify-center mb-3">
              <ClipboardList size={24} color="#5279AC" />
            </View>
            <Text className="font-lato-bold text-base text-neutral-900">
              No tasks
            </Text>
            <Text className="font-lato text-xs text-neutral-600 text-center mt-1.5">
              {status === '1'
                ? 'No completed tasks yet.'
                : 'Nothing is waiting on you right now.'}
            </Text>
          </View>
        </Card>
      ) : (
        <View style={{ opacity: loading ? 0.55 : 1 }}>
          {rows.map(row => (
            <TouchableOpacity
              key={row.id || row.title}
              activeOpacity={0.85}
              onPress={() =>
                navigation.navigate('TaskDetail', { taskId: row.id })
              }
              accessibilityRole="button"
              accessibilityLabel={`Open task ${row.title}`}>
              <Card className="bg-white rounded-2xl p-4 mb-3">
                <View className="flex-row items-center gap-3">
                  <View className="w-9 h-9 rounded-xl bg-primary-200 items-center justify-center">
                    <CheckCircle2 size={17} color="#5279AC" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-lato-bold text-sm text-neutral-900">
                      {row.title}
                    </Text>
                    <Text className="font-lato text-[11px] text-neutral-600 mt-0.5">
                      {status === '1' ? 'Completed' : 'Open'}
                    </Text>
                  </View>
                  <ChevronRight size={15} color="#A3ABC4" />
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </DashboardLayout>
  );
}
