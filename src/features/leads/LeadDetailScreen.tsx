import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import {
  ArrowLeft,
  Building2,
  CalendarPlus,
  Camera,
  CheckCircle2,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  Rows,
  TrendingUp,
} from 'lucide-react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { AlertBanner } from '../../shared/components/AlertBanner';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { TextField } from '../../shared/components/TextField';
import { FollowUpSheet } from '../followUps/FollowUpSheet';
import { MeetingSheet } from '../meetings/MeetingSheet';
import { LEAD_INFO_OPTIONS } from '../../services/options';
import { SelectField } from '../../shared/components/SelectField';
import {
  ALLOWED_IMAGE_EXTENSIONS,
  MAX_LEAD_IMAGE_BYTES,
  addLeadComment,
  fetchLeadDetail,
  updateLeadStatus,
  uploadLeadImage,
  type LeadDetail,
} from '../../services/leadDetailService';
import { fetchLeadFollowups, markFollowUpDone, type FollowUp } from '../../services/followupsService';
import {
  clearMeetingsCache,
  fetchAllMeetingsCached,
  type Meeting,
} from '../../services/meetingService';
import {
  MEETING_TYPE_LABELS,
  fetchPipelineStatusesCached,
  meetingsForLead,
  pickPrimaryMeeting,
  type PipelineStatus,
} from '../../services/leadsFilterService';
import { DEALS_DONE_OPTIONS } from '../../services/options';
import { formatBytes, validateFile, type PickedFile } from '../../services/mediaService';
import { dealDoneLabel, meetingTypeLabel } from '../../services/leadsFilterService';
import { whatsappUrl } from '../../services/whatsapp';
import { ApiError, describeApiError } from '../../services/httpClient';
import { useAuth } from '../../navigation/AuthContext';
import type { RootStackParamList } from '../../navigation/types';

const circleButton =
  'w-10 h-10 rounded-full border border-neutral-200 bg-white items-center justify-center';

/**
 * Label for a meeting's `meeting_type`.
 *
 * Not `meetingTypeLabel`, which maps a blank to "No Meeting" — that wording
 * belongs to a NULL column on the lead. A meeting with no type recorded is just
 * unknown, so it falls back to the venue text, trimmed and title-cased.
 */
const meetingKind = (meeting: Meeting | null) => {
  if (!meeting) {
    return '';
  }
  const code = meeting.type.trim().toLowerCase();
  if (code && MEETING_TYPE_LABELS[code]) {
    return MEETING_TYPE_LABELS[code];
  }
  return meeting.venue
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^./, char => char.toUpperCase());
};

/**
 * The pipeline stage that means "schedule a follow-up", matched by name.
 *
 * Pipeline status ids belong to the server
 * (`get_employee_visible_pipeline_statuses()`) and are not documented, so a
 * hardcoded id would break the moment the stages are renumbered. The name is
 * what the employee reads in the picker, and it is spelled differently across
 * deployments — "Followup", "Follow Up", "Follow-up Needed" — so spacing and
 * punctuation are dropped before comparing.
 */
const isFollowUpStage = (name: string) =>
  name.toLowerCase().replace(/[^a-z]/g, '').startsWith('followup');

/**
 * Newest first.
 *
 * The endpoint's own order is not documented, and a history that reads
 * oldest-first makes the meeting someone just logged look like the one they
 * forgot about.
 */
const sortByRecency = (meetings: Meeting[]) =>
  [...meetings].sort((a, b) => {
    const stamp = (meeting: Meeting) =>
      `${meeting.date || ''} ${meeting.time || ''}`;
    return stamp(b).localeCompare(stamp(a));
  });

export function LeadDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'LeadDetail'>>();
  const { user } = useAuth();
  const { leadId, investor, phone, company, e_co_id } = route.params;
  // Only the Leads screen passes this. The other three entry points (home
  // preview, follow-ups list, bell) reach a lead without it, and the detail
  // route still works — the company block is optional. Pass '' rather than
  // `undefined` so `fetchLeadDetail` gets the string its signature asks for.
  const companyId = e_co_id ?? '';

  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scheduling, setScheduling] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busyFollowUpId, setBusyFollowUpId] = useState<string | null>(null);
  const [followupsError, setFollowupsError] = useState(false);

  /**
   * A failed WhatsApp hand-off. Reported next to the button rather than
   * through the page-level `error`, which belongs to the lead's own load —
   * mixing the two would blank the screen over a link that would not open.
   */
  const [whatsappError, setWhatsappError] = useState<string | null>(null);

  /**
   * The pipeline value the lead held before it was moved into the follow-up
   * stage, so backing out of the form can put it back.
   *
   * A ref rather than state: this is a one-shot transaction, not something
   * the screen renders. It is cleared as soon as it has been used.
   */
  const previousPipelineRef = useRef<string | null>(null);

  /**
   * The stage is being put back after the follow-up form was abandoned. The
   * picker is disabled for the duration — a second change made mid-revert
   * would race it, and the revert would land on top of it.
   */
  const [reverting, setReverting] = useState(false);

  // A 403 on either the comment or the stage update means the lead belongs to
  // another employee. Both controls then stay disabled for the rest of the visit
  // — retrying cannot succeed, and the server is the only authority on this.
  const [commentForbidden, setCommentForbidden] = useState(false);
  const [stageForbidden, setStageForbidden] = useState(false);

  // Pipeline statuses label the stage picker. Cached, so entering a lead does
  // not repeat the dropdowns request the leads table already made.
  const [pipelineStatuses, setPipelineStatuses] = useState<PipelineStatus[]>([]);
  const [stageLoading, setStageLoading] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);
  const [stageSaving, setStageSaving] = useState<
    'pipeline' | 'deal_done' | null
  >(null);

  const pipelineOptions = useMemo(
    () =>
      pipelineStatuses.map(status => ({
        label: status.name,
        value: status.id,
      })),
    [pipelineStatuses],
  );

  /**
   * The stage that opens the follow-up form, or null when the server has no
   * such stage. Resolved by name because the ids are the server's own.
   */
  const followUpStageId = useMemo(
    () =>
      pipelineStatuses.find(status => isFollowUpStage(status.name))?.id ?? null,
    [pipelineStatuses],
  );

  /**
   * The server's own name for that stage, so the hint under the picker reads
   * the way the picker does instead of a hardcoded guess.
   */
  const followUpStageName = useMemo(
    () =>
      pipelineStatuses.find(status => status.id === followUpStageId)?.name ??
      'Follow up',
    [pipelineStatuses, followUpStageId],
  );

  const loadStageOptions = useCallback(async () => {
    setStageLoading(true);
    try {
      const statuses = await fetchPipelineStatusesCached();
      setPipelineStatuses(statuses);
      if (__DEV__) {
        // The status ids come from the server and are not documented, so they
        // are printed once: this is what tells us which id the app believes
        // is the follow-up stage.
        console.log('[lead] pipeline statuses', statuses);
      }
    } catch {
      // The label is cosmetic — the raw id still posts correctly, which is
      // exactly what the leads table does when its dropdown lookup misses.
    } finally {
      setStageLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadStageOptions();
    }, [loadStageOptions]),
  );

  /**
   * `POST /leads/status`. Ownership is enforced server-side, so there is no
   * pre-check against a cached assignment flag — it would go stale and either
   * hide a control this employee can still use, or offer one they cannot.
   */
  const onStageChange = async (
    field: 'pipeline' | 'deal_done',
    value: string,
  ) => {
    // Read before anything is patched below: this is where the lead was
    // before the change, which is what a backed-out follow-up puts back.
    const currentValue =
      field === 'pipeline' ? detail?.pipeline : detail?.dealDone;

    const opensFollowUpForm =
      field === 'pipeline' &&
      followUpStageId !== null &&
      value === followUpStageId;

    if (value === currentValue) {
      // The lead already holds this value, so there is nothing to send. The
      // follow-up stage is the case worth handling: choosing it again is how
      // the form is re-opened, and there is no reason to make the employee
      // wait for a request that cannot change anything.
      if (opensFollowUpForm) {
        // No stage change happened this time round, so there is nothing for
        // the form to undo if it is closed. Clearing the ref matters: a
        // leftover value from an earlier change would put the lead back into
        // a stage it left long ago.
        previousPipelineRef.current = null;
        setScheduling(true);
      }
      return;
    }

    setStageSaving(field);
    setStageError(null);

    if (__DEV__) {
      // Printed before the request so the outgoing values can be read next to
      // the server's response — a wrong id here is the usual cause.
      console.log(
        `[lead] stage change leadId=${leadId} field=${field} value="${value}" followUpStageId=${followUpStageId}`,
      );
    }

    try {
      await updateLeadStatus(leadId, field, value);
      // The server confirmed the value we sent, so patch it locally rather than
      // refetching the whole lead. The next focus re-reads it anyway.
      setDetail(current =>
        current
          ? {
            ...current,
            ...(field === 'pipeline'
              ? { pipeline: value }
              : { dealDone: value }),
          }
          : current,
      );

      // Moving the lead into the follow-up stage is what schedules the
      // follow-up — there is no separate button for it any more. The form
      // opens only once the status change itself succeeded, so a rejected
      // change never leaves a half-scheduled lead behind.
      if (opensFollowUpForm) {
        // Remembered so backing out of the form can undo the stage change.
        previousPipelineRef.current = currentValue ?? null;
        setScheduling(true);
      }
    } catch (stageErrorCaught) {
      const status =
        stageErrorCaught instanceof ApiError ? stageErrorCaught.status : 0;

      if (__DEV__) {
        console.warn(
          `[lead] stage update FAILED leadId=${leadId} field=${field} value="${value}" status=${status}`,
          stageErrorCaught,
        );
      }

      if (stageErrorCaught instanceof ApiError) {
        if (stageErrorCaught.status === 403) {
          setStageForbidden(true);
          setStageError('You can only update leads assigned to you.');
          return;
        }
        if (stageErrorCaught.status === 404) {
          setStageError('That lead no longer exists.');
          return;
        }
        setStageError(
          describeApiError(stageErrorCaught, 'Could not update the stage.'),
        );
        return;
      }
      setStageError('Could not update the stage.');
    } finally {
      setStageSaving(null);
    }
  };

  // The lead's own meeting history. The detail screen describes the lead the
  // same way the leads table does — by the meeting it actually has — rather
  // than by the lead's stored `meeting_type`, which can disagree with it.
  const [leadMeeting, setLeadMeeting] = useState<Meeting | null>(null);

  /** Every meeting logged against this lead, newest first. */
  const [leadMeetings, setLeadMeetings] = useState<Meeting[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFollowupsError(false);
    try {
      const [detailResult, followupResult, meetingsResult] =
        await Promise.allSettled([
          fetchLeadDetail(leadId, companyId),
          fetchLeadFollowups(leadId),
          fetchAllMeetingsCached(),
        ]);

      if (detailResult.status === 'fulfilled') {
        setDetail(detailResult.value);
      } else {
        setDetail(null);

        // The reason used to be swallowed here and replaced with a generic
        // sentence, which left a failed read indistinguishable from a server
        // with no message to give.
        console.warn(
          `[lead] detail fetch FAILED leadId=${leadId}`,
          detailResult.reason,
        );
        setError(
          describeApiError(
            detailResult.reason,
            'Something went wrong. Please try again.',
          ),
        );
      }

      if (followupResult.status === 'fulfilled') {
        setFollowups(followupResult.value);
      } else {
        setFollowups([]);
        setFollowupsError(true);
      }

      if (meetingsResult.status === 'fulfilled') {
        const mine = meetingsForLead(meetingsResult.value.meetings, leadId);
        setLeadMeetings(sortByRecency(mine));
        setLeadMeeting(pickPrimaryMeeting(mine));
      } else {
        // Non-fatal: the lead's own meeting_type still renders below.
        console.warn('meetings for lead failed', meetingsResult.reason);
        setLeadMeetings([]);
        setLeadMeeting(null);
      }
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onFollowUpDone = useCallback(async (id: string) => {
    setBusyFollowUpId(id);
    try {
      await markFollowUpDone(id);
      setFollowups(current =>
        current.map(row => (row.id === id ? { ...row, status: 'done' } : row)),
      );
    } catch (doneError) {
      setError(
        doneError instanceof ApiError && doneError.status === 403
          ? 'That lead belongs to another employee.'
          : 'Could not close the follow-up.',
      );
    } finally {
      setBusyFollowUpId(null);
    }
  }, []);

  /**
   * Puts the lead back where it was when the follow-up form was closed
   * without a follow-up being booked.
   *
   * Moving a lead into the follow-up stage and scheduling the follow-up are
   * one action, so leaving the form without scheduling has to undo the stage
   * change — otherwise the lead would sit in a stage that promises a
   * follow-up that does not exist.
   */
  const revertFollowUpStage = async () => {
    const previous = previousPipelineRef.current;
    previousPipelineRef.current = null;

    // The lead was already in the follow-up stage when the form opened, so
    // there is nothing to put back. The same goes for a lead that had no
    // stage at all — there is no value to restore.
    if (!previous || previous === followUpStageId) {
      return;
    }

    setReverting(true);
    setStageError(null);

    if (__DEV__) {
      console.log(
        `[lead] reverting stage leadId=${leadId} back to "${previous}"`,
      );
    }

    try {
      await updateLeadStatus(leadId, 'pipeline', previous);
      setDetail(current =>
        current ? { ...current, pipeline: previous } : current,
      );
    } catch (revertError) {
      // The lead is stuck in the follow-up stage on the server, with no
      // follow-up to show for it. Say so, and re-read the lead so the picker
      // shows what the server actually holds rather than what was intended.
      setStageError(
        describeApiError(revertError, 'Could not undo the stage change.'),
      );
      void load();
    } finally {
      setReverting(false);
    }
  };

  const title = investor || detail?.investor || 'Lead';

  /**
   * The follow-up exists now, so the stage change that opened the form is
   * settled rather than a transaction waiting to be undone.
   */
  const onFollowUpScheduled = async () => {
    previousPipelineRef.current = null;
    await load();
  };

  /**
   * A meeting was logged, so the meeting list is re-read rather than patched.
   *
   * The meetings endpoint has no lead filter, so the rows for this lead come
   * from a fetch of the employee's whole history — which is cached. The cache
   * is dropped first, otherwise the meeting would not appear until it aged
   * out and the screen would look like the save had failed.
   */
  const onMeetingCreated = async () => {
    clearMeetingsCache();
    await load();
  };

  /**
   * `meeting_status` is "1" when the lead has a meeting and "0" when it does
   * not. An empty value means the server sent neither, so fall back to the type:
   * a recorded type implies a meeting even without the flag.
   */
  const hasMeeting =
    (detail?.meetingStatus ?? '') === '1' ||
    (!detail?.meetingStatus && Boolean(detail?.meetingType));


  // The route's `phone` is optional — only the Leads screen passes it — so it
  // is coalesced into a plain string for the contact rows and the WhatsApp
  // link, which both read it as "may be missing" rather than "is a string".
  const phoneNumber = detail?.phone || phone || '';

  /**
   * The opening line of the WhatsApp chat. The employee's name is on the
   * signed-in profile, so the lead opens the chat already knowing who is
   * writing — it is still editable in WhatsApp.
   */
  const whatsappGreeting = user?.name
    ? `Hello, this is ${user.name} from the franchise team.`
    : 'Hello, this is the franchise team.';

  /**
   * Hands the lead over to WhatsApp with the number already dialled in.
   *
   * The https `wa.me` link opens WhatsApp directly when the app is installed
   * and falls back to the Play Store when it is not, so it never dead-ends.
   * A rejected `openURL` means the device has nothing that can handle it.
   */
  const openWhatsApp = () => {
    const url = whatsappUrl(phoneNumber, whatsappGreeting);

    if (!url) {
      setWhatsappError('This lead has no phone number to message.');
      return;
    }

    setWhatsappError(null);
    Linking.openURL(url).catch(() => {
      setWhatsappError('Could not open WhatsApp on this device.');
    });
  };


  console.log(detail, "details")

  return (
    <DashboardLayout
      title={title}
      subtitle={company || detail?.companyName || 'Lead detail'}
      onRefresh={load}
      refreshing={loading}
      showGoBack={true}
      showBell={false}>
      {error && (
        <View className="mb-4">
          <AlertBanner message={error} />
        </View>
      )}

      {loading && !detail ? (
        <View className="items-center py-10">
          <ActivityIndicator size="large" color="#5279AC" />
        </View>
      ) : null}

      {/* ---------- Stage ---------- */}
      <Card className="bg-white rounded-2xl p-4 mb-3">
        <Text className="font-lato-bold text-base text-neutral-900 mb-3">
          Stage
        </Text>

        <SelectField
          label="Pipeline status"
          placeholder={stageLoading ? 'Loading statuses…' : 'Select status'}
          value={detail?.pipeline}
          options={pipelineOptions}
          onChange={value => void onStageChange('pipeline', value)}
          searchable
          searchPlaceholder="Search statuses"
          loading={stageLoading || stageSaving !== null || reverting}
          disabled={stageForbidden || reverting}
          hint={
            followUpStageId !== null && detail?.pipeline === followUpStageId
              ? `This lead is in ${followUpStageName}. Choosing it again opens the follow-up form.`
              : undefined
          }
        />

        <Text className="text-neutral-700 font-lato-bold text-xs mb-1.5 ml-1">
          Deal done
        </Text>
        <View className="flex-row gap-3">
          {DEALS_DONE_OPTIONS.map(option => {
            const selected = detail?.dealDone === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                activeOpacity={0.8}
                disabled={stageForbidden || stageSaving !== null}
                onPress={() => void onStageChange('deal_done', option.value)}
                accessibilityRole="button"
                accessibilityState={{
                  selected,
                  disabled: stageForbidden || stageSaving !== null,
                }}
                className={`flex-1 items-center rounded-2xl px-4 py-3 border ${selected
                  ? 'border-primary-700 bg-primary-200'
                  : 'border-neutral-200 bg-white'
                  }`}>
                <Text
                  className={`font-lato-bold text-sm ${selected ? 'text-primary-700' : 'text-neutral-700'
                    }`}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {stageError ? (
          <Text className="text-red-500 font-lato text-xs mt-2">
            {stageError}
          </Text>
        ) : null}
      </Card>

      {/* ---------- Contact ---------- */}
      <Card className="bg-white rounded-2xl p-4">
        <View className="flex-row items-center justify-between gap-3 mb-3">
          <Text className="font-lato-bold text-base text-neutral-900">
            Contact
          </Text>

          {/* Only offered when there is a number to message — a lead captured
              without a phone has nothing for WhatsApp to open. */}
          {phoneNumber ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={openWhatsApp}
              className="flex-row items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#25D366]"
              accessibilityRole="button"
              accessibilityLabel={`Open a WhatsApp chat with ${title}`}>
              <MessageCircle size={15} color="#FFFFFF" />
              <Text className="font-lato-bold text-sm text-white">
                WhatsApp
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* A capture form can leave either channel blank, so each row only
            renders once it has something to show. */}
        {phoneNumber ? (
          <View className="flex-row items-center gap-2 mb-2">
            <Phone size={15} color="#5279AC" />
            <Text className="font-lato text-sm text-neutral-900">
              {phoneNumber}
            </Text>
          </View>
        ) : null}

        {detail?.email ? (
          <View className="flex-row items-center gap-2 mb-2">
            <Mail size={15} color="#5279AC" />
            <Text className="font-lato text-sm text-neutral-900 flex-1">
              {detail.email}
            </Text>
          </View>
        ) : null}

        {detail?.date ? (
          <View className="flex-row items-center gap-2 mb-2">
            <CalendarPlus size={15} color="#5279AC" />
            <Text className="font-lato text-sm text-neutral-900">
              {detail.date}
            </Text>
          </View>
        ) : null}

        {detail?.city ? (
          <View className="flex-row items-center gap-2 mb-2">
            <MapPin size={15} color="#5279AC" />
            <Text className="font-lato text-sm text-neutral-900">
              {detail.city}
            </Text>
          </View>
        ) : null}

        <View className="flex-row items-center gap-2 mb-2">
          <CheckCircle2 size={15} color="#5279AC" />
          <Text className="font-lato text-sm text-neutral-900">
            Deal done: {dealDoneLabel(detail?.dealDone ?? '') || '—'}
          </Text>
        </View>

        <View className="flex-row items-center gap-2 mb-2">
          <MessageSquare size={15} color="#5279AC" />
          <Text className="font-lato text-sm text-neutral-900 flex-1">
            {/* `meeting_status` answers "is there a meeting" directly. The type
                shown is the meeting's own, so this agrees with the badge on the
                leads table; the lead's stored meeting_type is the fallback when
                no meeting record is available. */}
            Meeting:{' '}
            {hasMeeting
              ? meetingKind(leadMeeting) ||
              meetingTypeLabel(detail?.meetingType ?? '') ||
              'Scheduled'
              : 'No meeting'}
          </Text>
        </View>

        {whatsappError ? (
          <Text className="text-red-500 text-xs font-lato mt-2">
            {whatsappError}
          </Text>
        ) : null}
      </Card>

      {detail?.message ? (
        <Card className="bg-white rounded-2xl p-4 mt-4">
          <Text className="font-lato-bold text-base text-neutral-900 mb-2">
            Investor message
          </Text>
          <Text className="font-lato text-sm text-neutral-700 leading-5">
            {detail.message}
          </Text>
        </Card>
      ) : null}

      {detail?.vcard ? (
        <Card className="bg-white rounded-2xl p-4 mt-4">
          <Text className="font-lato-bold text-base text-neutral-900 mb-2">
            Assigned to
          </Text>
          <Text className="font-lato text-sm text-neutral-900">
            {detail.vcard.name}
          </Text>
          {detail.vcard.contact ? (
            <Text className="font-lato text-xs text-neutral-700 mt-0.5">
              {detail.vcard.contact}
            </Text>
          ) : null}
          {detail.vcard.email ? (
            <Text className="font-lato text-xs text-neutral-700 mt-0.5">
              {detail.vcard.email}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Card className="bg-white rounded-2xl p-4 mt-4">
        <View className="flex-row items-center justify-between gap-3 mb-3">
          <Text className="font-lato-bold text-base text-neutral-900">
            Lead info
          </Text>
          <Button
            title="Add image"
            size="sm"
            icon={<Camera size={14} color="#FFFFFF" />}
            onPress={() => setUploadOpen(true)}
          />
        </View>

        {detail?.images.length ? (
          <View className="flex-row flex-wrap gap-3">
            {detail.images.map(image => (
              <View key={image.id} style={{ width: '47.5%' }}>
                <Image
                  source={{ uri: image.url }}
                  style={{
                    width: '100%',
                    height: 104,
                    borderRadius: 12,
                    backgroundColor: '#EEF0FF',
                  }}
                  resizeMode="cover"
                />
                <Text
                  className="font-lato-bold text-xs text-neutral-900 mt-1.5"
                  numberOfLines={1}>
                  {image.title || 'Untitled'}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className="font-lato text-xs text-neutral-600 leading-5">
            No images attached to this lead yet.
          </Text>
        )}
      </Card>

      {/* ---------- Meetings ---------- */}
      <Card className="bg-white rounded-2xl p-4 mt-4">
        <View className="flex-row items-center justify-between gap-3 mb-3">
          <Text className="font-lato-bold text-base text-neutral-900">
            Meetings
          </Text>
          <Button
            title="Schedule meeting"
            size="sm"
            icon={<CalendarPlus size={14} color="#FFFFFF" />}
            onPress={() => setMeetingOpen(true)}
          />
        </View>

        {leadMeetings.length === 0 ? (
          <Text className="font-lato text-xs text-neutral-600 leading-5">
            No meetings logged against this lead yet.
          </Text>
        ) : (
          leadMeetings.map((meeting, index) => {
            const kind = meetingKind(meeting);

            return (
              <View
                key={meeting.id || index}
                className="py-3"
                style={
                  index > 0
                    ? { borderTopWidth: 1, borderTopColor: '#EEF0FF' }
                    : undefined
                }>
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="font-lato-bold text-sm text-neutral-900">
                    {[meeting.date, meeting.time].filter(Boolean).join(' · ') ||
                      'No date'}
                  </Text>
                  {kind ? (
                    <View className="rounded-full bg-primary-200 px-3 py-1">
                      <Text className="font-lato-bold text-[11px] text-primary-700">
                        {kind}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {meeting.description ? (
                  <Text className="font-lato text-sm text-neutral-700 leading-5 mt-1.5">
                    {meeting.description}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </Card>

      {/* ---------- Follow-up history ---------- */}
      <Card className="bg-white rounded-2xl p-4 mt-4">
        {/* No "Schedule" button: moving the lead into the follow-up stage is
            what schedules one, so the form opens from the Stage card instead
            of from here. */}
        <Text className="font-lato-bold text-base text-neutral-900 mb-3">
          Follow-ups
        </Text>

        {followups.length === 0 ? (
          <Text className="font-lato text-xs text-neutral-600 leading-5">
            {/* A failed read must not read as an empty history. */}
            {followupsError
              ? 'Could not load follow-ups.'
              : 'Nothing scheduled for this lead.'}
          </Text>
        ) : (
          followups.map((followUp, index) => {
            const done = followUp.status.toLowerCase() === 'done';

            return (
              <View
                key={followUp.id || index}
                className="py-3"
                style={
                  index > 0
                    ? { borderTopWidth: 1, borderTopColor: '#EEF0FF' }
                    : undefined
                }>
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="font-lato-bold text-sm text-neutral-900">
                    {[followUp.date, followUp.time].filter(Boolean).join(' · ') ||
                      'No date'}
                  </Text>
                  {done ? (
                    <Text className="font-lato text-xs text-neutral-500">
                      Done
                    </Text>
                  ) : (
                    <Button
                      title="Mark done"
                      size="sm"
                      variant="outlined"
                      loading={busyFollowUpId === followUp.id}
                      disabled={busyFollowUpId !== null}
                      onPress={() => onFollowUpDone(followUp.id)}
                    />
                  )}
                </View>

                {followUp.comment ? (
                  <Text className="font-lato text-sm text-neutral-700 leading-5 mt-1.5">
                    {followUp.comment}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </Card>

      {/* ---------- Comments ---------- */}
      <Card className="bg-white rounded-2xl p-4 mt-4">
        <Text className="font-lato-bold text-base text-neutral-900 mb-2">
          Comments
        </Text>

        {detail?.comments.length ? (
          detail.comments.map((comment, index) => (
            <View
              key={comment.id || index}
              className="py-3"
              style={
                index > 0
                  ? { borderTopWidth: 1, borderTopColor: '#EEF0FF' }
                  : undefined
              }>
              <Text className="font-lato text-sm text-neutral-900 leading-5">
                {comment.comment}
              </Text>
              <Text className="font-lato text-[11px] text-neutral-600 mt-1">
                {[comment.employee, comment.created].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))
        ) : (
          <Text className="font-lato text-sm text-neutral-600 py-3">
            No comments on this lead yet.
          </Text>
        )}

        <CommentComposer
          leadId={leadId}
          onPosted={load}
          onForbidden={() => setCommentForbidden(true)}
          forbidden={commentForbidden}
        />
      </Card>

      <MeetingSheet
        visible={meetingOpen}
        leadId={leadId}
        lead={detail}
        companyId={e_co_id}
        onClose={() => setMeetingOpen(false)}
        onCreated={onMeetingCreated}
      />

      <FollowUpSheet
        visible={scheduling}
        initialLeadId={leadId}
        leadLabel={title}
        onClose={() => setScheduling(false)}
        // Backing out of the form abandons the follow-up, so the stage change
        // that opened it has to be undone.
        onDismissed={() => void revertFollowUpStage()}
        onScheduled={onFollowUpScheduled}
      />

      <LeadImageSheet
        visible={uploadOpen}
        leadId={leadId}
        onClose={() => setUploadOpen(false)}
        onUploaded={load}
      />
    </DashboardLayout>
  );
}

/* -------------------------------------------------------------------------- */
/*  Lead image upload                                                          */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Lead comment composer                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Posts to `POST /leads/:id/comments`.
 *
 * The 201 returns only `{ lead_id }` — no id, no created timestamp, no text —
 * so nothing is appended locally. `onPosted` re-reads the lead detail and the
 * thread re-renders from the server, which is the only copy that has an id.
 */
function CommentComposer({
  leadId,
  onPosted,
  onForbidden,
  forbidden,
}: {
  leadId: string;
  onPosted: () => void | Promise<void>;
  onForbidden: () => void;
  forbidden: boolean;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Write something first.');
      return;
    }

    setSending(true);
    setError(null);
    try {
      await addLeadComment(leadId, trimmed);
      setText('');
      await onPosted();
    } catch (postError) {
      if (postError instanceof ApiError) {
        if (postError.status === 403) {
          // Another employee's lead. Retrying will never succeed, so the
          // composer stays disabled for the rest of this visit.
          onForbidden();
          setError('You can only comment on leads assigned to you.');
          return;
        }
        if (postError.status === 404) {
          setError('That lead no longer exists.');
          return;
        }
        // `Comment is required` and friends arrive verbatim.
        setError(postError.message || 'Could not add the comment.');
        return;
      }
      setError('Could not add the comment.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View className="mt-3 pt-3 border-t border-neutral-200">
      <TextInput
        value={text}
        onChangeText={value => {
          setText(value);
          if (error) {
            setError(null);
          }
        }}
        placeholder="Add a comment…"
        placeholderTextColor="#A3ABC4"
        multiline
        editable={!sending && !forbidden}
        accessibilityLabel="Comment text"
        className="bg-neutral-100 rounded-2xl px-4 py-3 font-lato text-sm text-neutral-900 border border-neutral-200"
        style={{ minHeight: 72, textAlignVertical: 'top' }}
      />

      {error ? (
        <Text className="text-red-500 font-lato text-xs mt-1.5">
          {error}
        </Text>
      ) : null}

      <View className="flex-row justify-end mt-2">
        <Button
          title="Comment"
          size="sm"
          loading={sending}
          disabled={sending || forbidden || !text.trim()}
          onPress={() => void submit()}
        />
      </View>
    </View>
  );
}

function LeadImageSheet({
  visible,
  leadId,
  onClose,
  onUploaded,
}: {
  visible: boolean;
  leadId: string;
  onClose: () => void;
  onUploaded: () => void | Promise<void>;
}) {
  const [docType, setDocType] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A 403 means the lead belongs to another employee. Retrying will never
  // succeed, so the controls stay disabled for the rest of this session.
  const [forbidden, setForbidden] = useState(false);

  const choose = async (fromCamera: boolean) => {
    setError(null);
    const result = fromCamera
      ? await launchCamera({ mediaType: 'photo', includeBase64: false })
      : await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });

    if (result.didCancel) {
      return;
    }
    if (result.errorCode) {
      setError(result.errorMessage ?? 'Could not open your photos.');
      return;
    }

    const asset = (result.assets ?? [])[0];
    if (!asset?.uri) {
      return;
    }

    const picked: PickedFile = {
      uri: asset.uri,
      name: asset.fileName ?? `lead-${Date.now()}.jpg`,
      type: asset.type,
      size: asset.fileSize ?? null,
    };

    // The server caps this at 5048 KB, so reject before uploading rather than
    // letting the whole request fail after the bytes are already on the wire.
    const check = validateFile(
      picked.name,
      picked.size ?? null,
      MAX_LEAD_IMAGE_BYTES,
      ALLOWED_IMAGE_EXTENSIONS,
    );
    if (!check.ok) {
      setError(check.reason ?? 'That file cannot be attached.');
      return;
    }

    setFile(picked);
  };

  const submit = async () => {
    if (!file) {
      setError('Choose an image first.');
      return;
    }
    if (!docType) {
      setError('Choose a document type.');
      return;
    }

    setProgress(0);
    setError(null);
    try {
      await uploadLeadImage(leadId, docType, file, setProgress);
      setFile(null);
      setDocType('');
      onClose();
      await onUploaded();
    } catch (uploadError) {
      if (uploadError instanceof ApiError) {
        // CI3's own messages arrive verbatim and are already user-readable, so
        // they are preferred over anything invented here.
        if (uploadError.status === 403) {
          setForbidden(true);
          setError('You can only upload files for leads assigned to you.');
          return;
        }
        if (uploadError.status === 404) {
          setError('Lead not found.');
          return;
        }
        if (uploadError.status === 400) {
          setError(
            uploadError.message ||
            'That image was rejected. Use a jpg, jpeg, png or gif under 4.93 MB.',
          );
          return;
        }
      }
      setError('Upload failed. Please try again.');
    } finally {
      setProgress(null);
    }
  };

  const uploading = progress !== null && progress < 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-white rounded-t-3xl p-5">
          <Text className="font-lato-black text-lg text-neutral-900 mb-1">
            Upload Lead Info
          </Text>
          <Text className="font-lato text-xs text-neutral-600 mb-4">
            jpg, jpeg, png or gif · up to{' '}
            {formatBytes(MAX_LEAD_IMAGE_BYTES)}
          </Text>

          <SelectField
            label="Document type"
            required
            placeholder="Choose what you are attaching"
            value={docType}
            options={LEAD_INFO_OPTIONS}
            onChange={setDocType}
            modalTitle="Document type"
          />

          {file ? (
            <View className="flex-row items-center gap-3 mb-4">
              <Image
                source={{ uri: file.uri }}
                style={{ width: 64, height: 64, borderRadius: 12 }}
              />
              <View className="flex-1">
                <Text
                  className="font-lato-bold text-sm text-neutral-900"
                  numberOfLines={1}>
                  {file.name}
                </Text>
                <Text className="font-lato text-xs text-neutral-600">
                  {file.size ? formatBytes(file.size) : ''}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setFile(null)}
                accessibilityRole="button"
                accessibilityLabel="Remove selected image">
                <Text className="font-lato-bold text-xs text-red-500">
                  Remove
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-row gap-3 mb-4">
              <Button
                title="Choose photo"
                size="lg"
                variant="secondary"
                className="flex-1"
                disabled={forbidden}
                onPress={() => void choose(false)}
              />
              <Button
                title="Camera"
                size="lg"
                variant="outlined"
                className="flex-1"
                disabled={forbidden}
                onPress={() => void choose(true)}
              />
            </View>
          )}

          {error ? (
            <Text className="text-red-500 text-sm font-lato mb-3 text-center">
              {error}
            </Text>
          ) : null}

          {progress !== null && (
            <View className="bg-neutral-200 rounded-full h-1.5 overflow-hidden mb-4">
              <View
                className="bg-primary-700 h-full rounded-full"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </View>
          )}

          <View className="flex-row gap-3 pt-1">
            <Button
              title="Cancel"
              size="lg"
              variant="secondary"
              className="flex-1"
              disabled={uploading}
              onPress={onClose}
            />
            <Button
              title="Upload"
              size="lg"
              className="flex-1"
              loading={uploading}
              disabled={!file || forbidden}
              onPress={() => void submit()}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
