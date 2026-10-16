import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Text,
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
  TrendingUp,
} from 'lucide-react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { AlertBanner } from '../../shared/components/AlertBanner';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { TextField } from '../../shared/components/TextField';
import { FollowUpSheet } from '../followUps/FollowUpSheet';
import {
  ALLOWED_IMAGE_EXTENSIONS,
  MAX_LEAD_IMAGE_BYTES,
  fetchLeadDetail,
  uploadLeadImage,
  type LeadDetail,
} from '../../services/leadDetailService';
import { fetchLeadFollowups, markFollowUpDone, type FollowUp } from '../../services/followupsService';
import { formatBytes, validateFile, type PickedFile } from '../../services/mediaService';
import { dealDoneLabel, meetingTypeLabel } from '../../services/leadsFilterService';
import { ApiError } from '../../services/httpClient';
import type { RootStackParamList } from '../../navigation/types';

const detailLabel: Record<string, string> = {
  investor_budget: 'Budget',
  investment_range: 'Investment range',
  business_type: 'Business type',
  preferred_city: 'Preferred city',
  notes: 'Notes',
};

const circleButton =
  'w-10 h-10 rounded-full border border-neutral-200 bg-white items-center justify-center';

/** One caption/value row, rendered for every scalar the server returned. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row py-2">
      <Text className="font-lato text-xs text-neutral-600 w-36">{label}</Text>
      <Text className="font-lato-bold text-sm text-neutral-900 flex-1">
        {value}
      </Text>
    </View>
  );
}


export function LeadDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'LeadDetail'>>();
  const { leadId, investor, phone, company } = route.params;

  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scheduling, setScheduling] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busyFollowUpId, setBusyFollowUpId] = useState<string | null>(null);
  const [followupsError, setFollowupsError] = useState(false);


  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFollowupsError(false);
    try {
      const [detailResult, followupResult] = await Promise.allSettled([
        fetchLeadDetail(leadId),
        fetchLeadFollowups(leadId),
      ]);

      if (detailResult.status === 'fulfilled') {
        setDetail(detailResult.value);
      } else {
        setDetail(null);
        setError('Something went wrong. Please try again.');
      }

      if (followupResult.status === 'fulfilled') {
        setFollowups(followupResult.value);
      } else {
        setFollowups([]);
        setFollowupsError(true);
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

  // The list row is passed in for a fast first paint; the fetched detail wins
  // wherever it has a value, since the capture form can leave the row's own
  // phone empty.
  const phoneNumber = detail?.phone || phone;

  console.log(detail)

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
          <Text className="font-lato text-sm text-neutral-900">
            Meeting: {meetingTypeLabel(detail?.meetingType ?? '') || '—'}
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
      {detail?.comments.length ? (
        <Card className="bg-white rounded-2xl p-4 mt-4">
          <Text className="font-lato-bold text-base text-neutral-900 mb-2">
            Comments
          </Text>
          {detail.comments.map((comment, index) => (
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
          ))}
        </Card>
      ) : null}


      {detail?.detail?.img_path ? (
        <View
          style={{
            shadowColor: "#000",
            elevation: 3
          }}
        >
          <Image
            source={{ uri: `https://franchisepk.com/${detail.detail.img_path}` }}
            style={{ width: '100%', height: 200, elevation: 3, shadowColor: "#000" }}
            className='rounded-2xl mt-4'
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        </View>
      ) : null}

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
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (!title.trim()) {
      setError('Add a short title.');
      return;
    }

    setProgress(0);
    setError(null);
    try {
      await uploadLeadImage(leadId, title.trim(), file, setProgress);
      setFile(null);
      setTitle('');
      onClose();
      await onUploaded();
    } catch (uploadError) {
      setError(
        uploadError instanceof ApiError && uploadError.status === 400
          ? 'That image was rejected. Use a jpg, jpeg, png or gif under 5 MB.'
          : 'Upload failed. Please try again.',
      );
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
            Attach an image
          </Text>
          <Text className="font-lato text-xs text-neutral-600 mb-4">
            jpg, jpeg, png or gif · up to{' '}
            {formatBytes(MAX_LEAD_IMAGE_BYTES)}
          </Text>

          <TextField
            label="Title"
            required
            placeholder="e.g. Storefront"
            value={title}
            onChangeText={setTitle}
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
                onPress={() => void choose(false)}
              />
              <Button
                title="Camera"
                size="lg"
                variant="outlined"
                className="flex-1"
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
              disabled={!file}
              onPress={() => void submit()}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
