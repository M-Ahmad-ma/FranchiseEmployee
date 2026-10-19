import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { ApiError } from '../../services/httpClient';
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

export function LeadDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'LeadDetail'>>();
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
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busyFollowUpId, setBusyFollowUpId] = useState<string | null>(null);
  const [followupsError, setFollowupsError] = useState(false);

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

  const loadStageOptions = useCallback(async () => {
    setStageLoading(true);
    try {
      setPipelineStatuses(await fetchPipelineStatusesCached());
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
    setStageSaving(field);
    setStageError(null);
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
    } catch (stageErrorCaught) {
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
        setStageError(stageErrorCaught.message || 'Could not update the stage.');
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

        console.warn('lead detail failed', detailResult.reason);
        setError('Something went wrong. Please try again.');
      }

      if (followupResult.status === 'fulfilled') {
        setFollowups(followupResult.value);
      } else {
        setFollowups([]);
        setFollowupsError(true);
      }

      if (meetingsResult.status === 'fulfilled') {
        setLeadMeeting(
          pickPrimaryMeeting(
            meetingsForLead(meetingsResult.value.meetings, leadId),
          ),
        );
      } else {
        // Non-fatal: the lead's own meeting_type still renders below.
        console.warn('meetings for lead failed', meetingsResult.reason);
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

  const title = investor || detail?.investor || 'Lead';

  /**
   * `meeting_status` is "1" when the lead has a meeting and "0" when it does
   * not. An empty value means the server sent neither, so fall back to the type:
   * a recorded type implies a meeting even without the flag.
   */
  const hasMeeting =
    (detail?.meetingStatus ?? '') === '1' ||
    (!detail?.meetingStatus && Boolean(detail?.meetingType));


  const phoneNumber = detail?.phone || phone;

  return (
    <DashboardLayout
      title={title}
      subtitle={company || detail?.companyName || detail?.company?.name || 'Lead detail'}
      onRefresh={load}
      refreshing={loading}
      showBell={false}>
      {/* Back button sits above the layout title, matching the drawer's slot. */}
      <View className="-mt-1 mb-3">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.goBack()}
          className={circleButton}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <ArrowLeft size={18} color="#3F465C" />
        </TouchableOpacity>
      </View>

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
          loading={stageLoading || stageSaving !== null}
          disabled={stageForbidden}
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
        <Text className="font-lato-bold text-base text-neutral-900 mb-3">
          Contact
        </Text>

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

        <View className="flex-row items-center gap-2">
          <TrendingUp size={15} color="#5279AC" />
          <Text className="font-lato text-sm text-neutral-900">
            Status: {detail?.pipeline || '—'}
          </Text>
        </View>
      </Card>

      {/* ---------- Investor message ---------- */}
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


      {/* ---------- Company ---------- */}
      {detail?.company ? (
        <Card className="bg-white rounded-2xl p-4 mt-4">
          <View className="flex-row items-center gap-2 mb-3">
            <Building2 size={16} color="#5279AC" />
            <Text className="font-lato-bold text-base text-neutral-900">
              {detail.company.name}
            </Text>
          </View>

          {detail.company.address ? (
            <Text className="font-lato text-sm text-neutral-700 leading-5 mb-1">
              {detail.company.address}
            </Text>
          ) : null}
          {detail.company.contact ? (
            <Text className="font-lato text-sm text-neutral-700 mb-1">
              {detail.company.contact}
            </Text>
          ) : null}
          {detail.company.website ? (
            <View className="flex-row items-center gap-2">
              <Mail size={15} color="#8990A8" />
              <Text className="font-lato text-sm text-neutral-700" numberOfLines={1}>
                {detail.company.website}
              </Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* ---------- Assigned employee ---------- */}
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

      {/* ---------- Images ---------- */}
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

      {/* ---------- Follow-up history ---------- */}
      <Card className="bg-white rounded-2xl p-4 mt-4">
        <View className="flex-row items-center justify-between gap-3 mb-3">
          <Text className="font-lato-bold text-base text-neutral-900">
            Follow-ups
          </Text>
          <Button
            title="Schedule"
            size="sm"
            variant="secondary"
            icon={<CalendarPlus size={14} color="#FFFFFF" />}
            onPress={() => setScheduling(true)}
          />
        </View>

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

      <FollowUpSheet
        visible={scheduling}
        initialLeadId={leadId}
        onClose={() => setScheduling(false)}
        onScheduled={load}
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
