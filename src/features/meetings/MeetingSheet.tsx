import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CalendarPlus, X } from 'lucide-react-native';
import { Button } from '../../shared/components/Button';
import { DateField } from '../../shared/components/DateField';
import { SelectField } from '../../shared/components/SelectField';
import { TextField } from '../../shared/components/TextField';
import { TimeField } from '../../shared/components/TimeField';
import { createMeeting } from '../../services/meetingService';
import { fetchCompanyOptionsCached } from '../../services/leadsFilterService';
import { MEETING_TYPE_CREATE_OPTIONS } from '../../services/options';
import { ApiError, describeApiError } from '../../services/httpClient';
import { toApiDate, type Option } from '../../services/utils';
import type { LeadDetail } from '../../services/leadDetailService';

interface Props {
  visible: boolean;
  /** The lead the meeting is logged against. */
  leadId?: string;
  /** The lead, for the fields that can be filled in from it. */
  lead?: LeadDetail | null;
  /**
   * The lead row's company id.
   *
   * Only the Leads screen knows it — the home preview, the follow-ups list
   * and the bell reach a lead without it. The company picker fills the gap.
   */
  companyId?: string;
  onClose: () => void;
  /** Called after a meeting is created, so the list can be re-read. */
  onCreated: () => void | Promise<void>;
}
function todayIso() {
  const now = new Date();
  return toApiDate(
    `${String(now.getMonth() + 1).padStart(2, '0')}/${String(
      now.getDate(),
    ).padStart(2, '0')}/${now.getFullYear()}`,
  ) as string;
}

/**
 * Logs a meeting against a lead.
 *
 * The field names mirror the web app's own meeting form, because the
 * controller reads them by name. The employee is never sent — the server
 * stamps the id and the name from the session.
 */
export function MeetingSheet({
  visible,
  leadId,
  lead,
  companyId,
  onClose,
  onCreated,
}: Props) {
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState('10:00');
  const [meetingType, setMeetingType] = useState<string | undefined>(undefined);
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [person, setPerson] = useState('');
  const [company, setCompany] = useState<string | undefined>(undefined);
  const [companies, setCompanies] = useState<Option[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The lead's own company id, when the screen knows it. The picker
  // overrides it the moment the employee chooses a different one.
  const leadCompanyId = companyId || undefined;

  const loadCompanies = useCallback(async () => {
    setLoadingCompanies(true);
    try {
      setCompanies(await fetchCompanyOptionsCached());
    } catch {
      // Not fatal: the lead's own company can still be sent, and the form
      // says so rather than silently dropping the field.
      setCompanies([]);
    } finally {
      setLoadingCompanies(false);
    }
  }, []);

  // Reset on every open, so a meeting logged last week does not come back
  // pre-filled.
  useEffect(() => {
    if (!visible) {
      return;
    }
    setError(null);
    setDate(todayIso());
    setTime('10:00');
    setMeetingType(undefined);
    setVenue('');
    setDescription('');
    setPerson('');
    setCompany(leadCompanyId);
    void loadCompanies();
  }, [visible, leadCompanyId, loadCompanies]);

  /**
   * The name sent alongside the company id.
   *
   * The id is what the server joins on, but it also wants the name, and the
   * name has to match the id that was chosen — a lead's own brand name is
   * only used when no option was picked.
   */
  const companyName = useMemo(() => {
    const picked = companies.find(option => option.value === company);
    if (picked) {
      return picked.label;
    }
    // The lead's own company, when the picker does not carry it — the id is
    // still the right one to send, and the name is on the lead row.
    if (company && company === leadCompanyId) {
      return lead?.companyName || '';
    }
    return '';
  }, [companies, company, leadCompanyId, lead]);

  const close = () => {
    if (saving) {
      return;
    }
    onClose();
  };

  const submit = async () => {
    const isoDate = toApiDate(date);
    const trimmedVenue = venue.trim();
    const trimmedDescription = description.trim();
    const trimmedPerson = person.trim();

    if (!isoDate) {
      setError('Pick a valid date.');
      return;
    }
    if (!time) {
      setError('Pick a time.');
      return;
    }
    if (!trimmedVenue) {
      setError('Where did the meeting happen?');
      return;
    }
    if (!trimmedDescription) {
      setError('Add a short description of what was discussed.');
      return;
    }
    if (!company) {
      setError('Choose the company the meeting was with.');
      return;
    }
    if (!companyName) {
      setError('Could not work out the company name. Pick the company again.');
      return;
    }
    if (!trimmedPerson) {
      setError('Add the name of the person you met.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createMeeting({
        date: isoDate,
        time,
        venue: trimmedVenue,
        description: trimmedDescription,
        companyId: company,
        company: companyName,
        person: trimmedPerson,
        // Omitted rather than sent blank when there is no type.
        meetingType: meetingType,
        leadId,
        // The franchisee is the lead this meeting was held with.
        franchise: lead?.investor,
        franchisePhone: lead?.phone,
        email: lead?.email,
      });
      onClose();
      await onCreated();
    } catch (submitError) {
      const status = submitError instanceof ApiError ? submitError.status : 0;

      if (__DEV__) {
        console.warn(
          `[meeting] create FAILED leadId=${leadId} status=${status}`,
          submitError,
        );
      }

      // A 400 lists the missing fields by name, so its message is shown
      // verbatim rather than replaced.
      setError(
        submitError instanceof ApiError && submitError.status === 400
          ? submitError.message
          : describeApiError(
            submitError,
            'Could not log the meeting. Please try again.',
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
      onRequestClose={close}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[92%]">
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
              <Text className="font-lato-black text-lg text-neutral-900">
                Schedule meeting
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={close}
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
              {lead ? (
                <View className="rounded-2xl bg-neutral-200 px-4 py-3 mb-4">
                  <Text className="font-lato-bold text-sm text-neutral-900">
                    {lead.investor || 'Unnamed lead'}
                  </Text>
                  {lead.companyName ? (
                    <Text className="font-lato text-xs text-neutral-700 mt-0.5">
                      {lead.companyName}
                    </Text>
                  ) : null}
                </View>
              ) : null}

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

              <SelectField
                label="Meeting type"
                placeholder="Not set"
                value={meetingType}
                options={MEETING_TYPE_CREATE_OPTIONS}
                onChange={setMeetingType}
                modalTitle="Meeting type"
              />

              <SelectField
                label="Company"
                required
                placeholder={
                  loadingCompanies
                    ? 'Loading companies…'
                    : companies.length
                      ? 'Select a company'
                      : 'No companies available'
                }
                value={company}
                options={companies}
                onChange={setCompany}
                loading={loadingCompanies}
                searchable
                searchPlaceholder="Search companies"
                modalTitle="Select a company"
              />

              <TextField
                label="Contact person"
                required
                placeholder="Who did you meet at the company?"
                value={person}
                onChangeText={setPerson}
              />

              <TextField
                label="Venue"
                required
                placeholder="Where did it happen?"
                value={venue}
                onChangeText={setVenue}
              />

              <TextField
                label="Description"
                required
                placeholder="The points you covered"
                value={description}
                onChangeText={setDescription}
                multiline
              />

              {error ? (
                <Text className="text-red-500 text-sm font-lato mb-3 text-center">
                  {error}
                </Text>
              ) : null}
            </ScrollView>

            <View className="flex-row gap-3 px-5 pt-2 pb-6">
              <Button
                title="Cancel"
                size="lg"
                variant="primary"
                className="flex-1"
                disabled={saving}
                onPress={close}
              />
              <Button
                title="Save meeting"
                variant='secondary'
                size="lg"
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
