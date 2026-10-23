import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CalendarPlus, Search, X } from 'lucide-react-native';
import { Button } from '../../shared/components/Button';
import { DateField } from '../../shared/components/DateField';
import { SelectField } from '../../shared/components/SelectField';
import { TextField } from '../../shared/components/TextField';
import { TimeField } from '../../shared/components/TimeField';
import {
  createFollowUp,
  type NewFollowUp,
} from '../../services/followupsService';
import {
  fetchFilteredLeads,
  type LeadFilterRow,
} from '../../services/leadsFilterService';
import { ApiError, describeApiError } from '../../services/httpClient';
import { toApiDate, type Option } from '../../services/utils';

interface Props {
  visible: boolean;
  /** Pre-selects a lead — used when scheduling from a lead's own detail. */
  initialLeadId?: string;
  /** The lead's name, shown when the lead is fixed to this one. */
  leadLabel?: string;
  onClose: () => void;
  /**
   * Called when the sheet is closed *without* a follow-up being created.
   *
   * The lead detail screen opens this sheet as the second half of a stage
   * change, and closes it by backing out — so it needs to hear about that
   * case separately from a successful schedule, which calls `onClose` too.
   */
  onDismissed?: () => void;
  /** Called after a follow-up is created, so the queue can refetch. */
  onScheduled: () => void | Promise<void>;
}

/** How many leads the picker offers before the search box narrows it. */
const LEAD_PAGE_SIZE = 50;

function todayIso() {
  const now = new Date();
  return toApiDate(
    `${String(now.getMonth() + 1).padStart(2, '0')}/${String(
      now.getDate(),
    ).padStart(2, '0')}/${now.getFullYear()}`,
  ) as string;
}

/**
 * Schedules a follow-up against one of the employee's own leads.
 *
 * Leads come from the same filter endpoint the Requests screen uses — there is
 * no standalone "my leads" endpoint — so the picker fetches a page and then
 * searches server-side as the user types.
 */
export function FollowUpSheet({
  visible,
  initialLeadId,
  leadLabel,
  onClose,
  onDismissed,
  onScheduled,
}: Props) {
  const [leads, setLeads] = useState<LeadFilterRow[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leadQuery, setLeadQuery] = useState('');
  const [leadId, setLeadId] = useState<string | undefined>(initialLeadId);
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState<string | undefined>('10:00');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLeads = useCallback(async (search?: string) => {
    setLoadingLeads(true);
    try {
      const { data } = await fetchFilteredLeads({
        investor: search,
        perPage: LEAD_PAGE_SIZE,
      });
      setLeads(data.leads);
    } catch {
      setError('Could not load your leads. Please try again.');
    } finally {
      setLoadingLeads(false);
    }
  }, []);

  // Fetch once per open, and again once the user stops typing. Scheduling from
  // a lead's own detail preselects that lead, so the search stays idle.
  useEffect(() => {
    if (!visible) {
      return;
    }
    setError(null);
    if (initialLeadId) {
      setLeadId(initialLeadId);
      return;
    }
    setLeadId(undefined);
    void loadLeads();
  }, [initialLeadId, visible, loadLeads]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    // The lead is fixed on this path, so there is nothing to search for and
    // no list worth fetching.
    if (initialLeadId) {
      return;
    }
    const timer = setTimeout(() => {
      void loadLeads(leadQuery.trim() || undefined);
    }, 400);
    return () => clearTimeout(timer);
  }, [initialLeadId, leadQuery, visible, loadLeads]);

  const leadOptions: Option[] = useMemo(
    () =>
      leads.map(lead => ({
        value: lead.id,
        label: [lead.investor || 'Unnamed lead', lead.brand]
          .filter(Boolean)
          .join(' · '),
      })),
    [leads],
  );

  const reset = () => {
    setLeadId(initialLeadId);
    setLeadQuery('');
    setDate(todayIso());
    setTime('10:00');
    setComment('');
    setError(null);
  };

  /**
   * Closed by the person, without a follow-up being created.
   *
   * `onDismissed` fires first and separately from `onClose` because a
   * successful schedule closes the sheet too — and the caller has to be able
   * to tell the two apart.
   */
  const dismiss = () => {
    if (saving) {
      return;
    }
    onDismissed?.();
    onClose();
  };

  /** Closed because a follow-up was created — nothing was abandoned. */
  const finish = () => {
    onClose();
  };

  const submit = async () => {
    const isoDate = toApiDate(date);
    const trimmedComment = comment.trim();

    if (!leadId) {
      setError('Choose a lead first.');
      return;
    }
    if (!isoDate) {
      setError('Pick a valid date.');
      return;
    }
    if (!time) {
      setError('Pick a time.');
      return;
    }
    if (!trimmedComment) {
      setError('Add a short comment — it is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: NewFollowUp = {
        leadId,
        date: isoDate,
        time,
        comment: trimmedComment,
      };
      await createFollowUp(payload);
      reset();
      finish();
      await onScheduled();
    } catch (submitError) {
      const status = submitError instanceof ApiError ? submitError.status : 0;

      if (__DEV__) {
        console.warn(
          `[followUp] create FAILED leadId=${leadId} date=${isoDate} time=${time} status=${status}`,
          submitError,
        );
      }

      setError(
        submitError instanceof ApiError && submitError.status === 400
          ? 'Check the date, time and comment, then try again.'
          : describeApiError(
            submitError,
            'Could not schedule the follow-up. Please try again.',
          ),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={dismiss}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[92%]">
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
              <Text className="font-lato-black text-lg text-neutral-900">
                Schedule follow-up
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={dismiss}
                disabled={saving}
                className="w-9 h-9 rounded-full bg-neutral-200 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Close">
                <X size={16} color="#6F778E" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              className="px-5">
              {initialLeadId ? (
                // Opened from a lead's own detail, so the lead is fixed: the
                // picker would only offer to change something that cannot
                // change. It also used to render empty here — with the lead
                // list never loaded for this path, the field fell back to its
                // placeholder while the lead was preselected underneath.
                <View className="mb-4">
                  <Text className="text-neutral-700 font-lato-bold text-xs mb-1.5 ml-1">
                    Lead
                  </Text>
                  <View className="rounded-2xl px-4 py-3.5 border border-neutral-200 bg-neutral-100 flex-row items-center">
                    <Text
                      className="font-lato text-base text-neutral-900 flex-1"
                      numberOfLines={1}>
                      {leadLabel || 'This lead'}
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  <TextField
                    label="Find lead"
                    placeholder="Search by name or phone"
                    value={leadQuery}
                    onChangeText={setLeadQuery}
                    rightSlot={<Search size={16} color="#A3ABC4" />}
                  />

                  {loadingLeads ? (
                    <View className="items-center py-4">
                      <ActivityIndicator color="#5279AC" />
                    </View>
                  ) : (
                    <SelectField
                      label="Lead"
                      required
                      placeholder={
                        leadOptions.length
                          ? 'Select a lead'
                          : 'No leads match that search'
                      }
                      value={leadId}
                      options={leadOptions}
                      onChange={setLeadId}
                      modalTitle="Select a lead"
                      searchable
                      searchPlaceholder="Search by name or phone"
                    />
                  )}
                </>
              )}

              <View className="flex-row gap-4">
                <View className="flex-1">
                  <DateField
                    label="Date"
                    required
                    value={date}
                    onChange={setDate}
                  />
                </View>
                <View className="flex-1">
                  <TimeField
                    label="Time"
                    required
                    value={time}
                    onChange={setTime}
                  />
                </View>
              </View>

              <TextField
                label="Comment"
                required
                placeholder="What needs to happen on this call?"
                value={comment}
                onChangeText={setComment}
                multiline
              />

              {error && (
                <Text className="text-red-500 text-sm font-lato mb-3 text-center">
                  {error}
                </Text>
              )}
            </ScrollView>

            <View className="flex-row gap-3 px-5 pt-2 pb-6">
              <Button
                title="Cancel"
                size="lg"
                variant="primary"
                className="flex-1"
                disabled={saving}
                onPress={dismiss}
              />
              <Button
                title="Schedule"
                size="lg"
                variant='secondary'
                className="flex-1"
                loading={saving}
                icon={<CalendarPlus size={16} color="#FFFFFF" />}
                onPress={() => void submit()}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
