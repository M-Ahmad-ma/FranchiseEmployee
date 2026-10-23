import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CalendarClock, CheckCircle2 } from 'lucide-react-native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { AlertBanner } from '../../shared/components/AlertBanner';
import { Badge } from '../../shared/components/Badge';
import { Button } from '../../shared/components/Button';
import { TabGroup, type TabItem } from '../../shared/components/TabGroup';
import { FollowUpCard } from './FollowUpCard';
import { FollowUpSheet } from './FollowUpSheet';
import {
  fetchFollowups,
  markFollowUpDone,
  type FollowUp,
} from '../../services/followupsService';
import { fetchCompanyOptionsCached } from '../../services/leadsFilterService';
import { ApiError } from '../../services/httpClient';
import type { RootStackParamList } from '../../navigation/types';

const STATUS_TABS: TabItem[] = [
  { key: 'active', label: 'Active' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'done', label: 'Done' },
  { key: 'all', label: 'All' }
];

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

  /**
   * Company id to name, for the card's company line.
   *
   * Follow-up rows carry `e_co_id` on the live API, and an id on a card says
   * nothing. The same cached dropdowns the filter screen loads answer the
   * lookup, so this costs no extra request once they have been fetched.
   */
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});

  /**
   * The pull gesture only. `loading` also covers the focus fetch and the tab
   * switch, and feeding that to the RefreshControl made its spinner animate on
   * top of the list's own spinner for a single request.
   */
  const [pullRefreshing, setPullRefreshing] = useState(false);

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

  /**
   * Best-effort: the company line is context, not the point of the card, so a
   * failure simply leaves it out rather than adding another banner to the
   * screen.
   */
  const loadCompanyNames = useCallback(async () => {
    try {
      const options = await fetchCompanyOptionsCached();
      const next: Record<string, string> = {};
      for (const option of options) {
        next[option.value] = option.label;
      }
      setCompanyNames(next);
    } catch {
      // Silent by design — see above.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      void loadCompanyNames();
    }, [load, loadCompanyNames]),
  );

  /** The pull gesture only — the focus fetch and tab switches stay silent. */
  const refresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await load();
    } finally {
      setPullRefreshing(false);
    }
  }, [load]);

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

  /**
   * A row's company as readable text.
   *
   * A value that is already a name passes through; one that matches a known
   * company id becomes that company's name. An unresolved numeric id is
   * dropped rather than shown, because "42" under a building icon is worse
   * than no line at all.
   */
  const companyLabel = (value: string): string | undefined => {
    const raw = value.trim();
    if (!raw || raw === '—' || raw === '-') {
      return undefined;
    }
    const resolved = companyNames[raw];
    if (resolved) {
      return resolved;
    }
    return /^\d+$/.test(raw) ? undefined : raw;
  };

  const openLead = (followUp: FollowUp) =>
    navigation.navigate('LeadDetail', {
      leadId: followUp.leadId,
      investor: followUp.investor,
      phone: followUp.phone,
      company: followUp.company,
    });

  return (
    <DashboardLayout
      title="Lead Follow-ups"
      subtitle="leads assigned to you"
      showMenu
      onRefresh={refresh}
      refreshing={pullRefreshing}>
      <TabGroup tabs={STATUS_TABS} value={status} onChange={setStatus} />

      <View className="flex-row items-center justify-between gap-3 mb-3">
        <Badge
          label={`Follow-ups: ${loading && rows.length === 0 ? '—' : rows.length
            }`}
          tone="primary"
        />
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

      {/* Cards are not wrapped in a card of their own: each follow-up is a
          card, and nesting them would double the shadow and the padding. */}
      {rows.length === 0 ? (
        // Only the first load blanks the list. Switching tabs or refocusing
        // keeps the cards on screen, dimmed, rather than flashing a spinner —
        // a spinner there reads as "no follow-ups".
        loading ? (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="#5279AC" />
          </View>
        ) : (
          <AlertBanner
            message={
              status === 'active'
                ? 'No follow-ups are outstanding.'
                : 'No follow-ups have been scheduled yet.'
            }
          />
        )
      ) : (
        <View
          style={{ opacity: loading ? 0.55 : 1 }}
          accessibilityState={{ busy: loading }}>
          {rows.map(row => (
            <FollowUpCard
              key={row.id}
              followUp={row}
              onPress={openLead}
              showComment
              companyLabel={companyLabel(row.company)}
              action={
                row.status.toLowerCase() === 'done' ? undefined : (
                  <Button
                    title="Mark done"
                    size="sm"
                    variant="outlined"
                    loading={pendingId === row.id}
                    disabled={pendingId !== null}
                    icon={<CheckCircle2 size={14} color="#5279AC" />}
                    onPress={() => onDone(row.id)}
                  />
                )
              }
            />
          ))}
        </View>
      )}

      <FollowUpSheet
        visible={scheduling}
        onClose={() => setScheduling(false)}
        onScheduled={load}
      />
    </DashboardLayout>
  );
}
