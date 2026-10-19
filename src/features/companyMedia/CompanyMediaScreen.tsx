import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  FileText,
  Filter,
  Link2,
  MapPin,
  RefreshCw,
  // Trash2 is only referenced by the commented-out delete button.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Trash2,
  Upload,
  Video,
} from 'lucide-react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import {
  pick,
  type DocumentPickerResponse,
} from '@react-native-documents/picker';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { AlertBanner } from '../../shared/components/AlertBanner';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { MediaViewer } from '../../shared/components/MediaViewer';
import { SelectField } from '../../shared/components/SelectField';
import { TextField } from '../../shared/components/TextField';
import {
  ALLOWED_MEDIA_EXTENSIONS,
  BRAND_LOCATION_OPTION,
  MAX_MEDIA_BYTES,
  deleteMedia,
  fetchCompanyMedia,
  fetchMediaDropdowns,
  formatBytes,
  uploadMedia,
  validateFile,
  type CompanyMediaFile,
  type MediaCompany,
  type MediaOption,
  type PickedFile,
} from '../../services/mediaService';
import { ApiError } from '../../services/httpClient';
import type { Option } from '../../services/utils';

interface Props {
  visible: boolean;
  companyId: string;
  optionId: string;
  mediaOptions: MediaOption[];
  onClose: () => void;
  onUploaded: () => void | Promise<void>;
}

/**
 * Upload sheet for one company + media type.
 *
 * The server's upload limit is 0 (unlimited) and `POST /leads/info` caps at
 * 5MB, so every file is checked here before it is appended — otherwise a
 * multi-gigabyte video would stream straight into the uploads directory.
 */
function UploadSheet({
  visible,
  companyId,
  optionId,
  mediaOptions,
  onClose,
  onUploaded,
}: Props) {
  const selected = mediaOptions.find(option => option.id === optionId);
  const isLocation = selected?.name === BRAND_LOCATION_OPTION;

  const [files, setFiles] = useState<PickedFile[]>([]);
  const [locationUrl, setLocationUrl] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const addFiles = (picked: PickedFile[]) => {
    setError(null);
    const rejected: string[] = [];

    for (const file of picked) {
      // A picker row with no uri is unusable — the camera or a cancelled
      // selection can produce one.
      if (!file.uri) {
        rejected.push(`${file.name} could not be read.`);
        continue;
      }

      const check = validateFile(
        file.name,
        file.size ?? null,
        MAX_MEDIA_BYTES,
        ALLOWED_MEDIA_EXTENSIONS,
      );
      if (check.ok) {
        setFiles(current => [...current, file]);
      } else {
        rejected.push(check.reason ?? file.name);
      }
    }

    if (rejected.length) {
      setError(rejected.join('\n'));
    }
  };

  const pickImages = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 0,
      includeBase64: false,
    });
    if (result.didCancel) {
      return;
    }
    if (result.errorCode) {
      setError(result.errorMessage ?? 'Could not open your photos.');
      return;
    }
    addFiles(
      (result.assets ?? []).map(asset => ({
        uri: asset.uri,
        name: asset.fileName ?? `image-${Date.now()}.jpg`,
        type: asset.type,
        size: asset.fileSize ?? null,
      })),
    );
  };

  const pickVideo = async () => {
    const result = await launchImageLibrary({
      mediaType: 'video',
      selectionLimit: 0,
      includeBase64: false,
    });
    if (result.didCancel) {
      return;
    }
    if (result.errorCode) {
      setError(result.errorMessage ?? 'Could not open your videos.');
      return;
    }
    addFiles(
      (result.assets ?? []).map(asset => ({
        uri: asset.uri,
        name: asset.fileName ?? `video-${Date.now()}.mp4`,
        type: asset.type,
        size: asset.fileSize ?? null,
      })),
    );
  };

  const pickPdf = async () => {
    try {
      const result: DocumentPickerResponse[] = await pick({
        type: ['application/pdf'],
        allowMultiSelection: true,
      });
      addFiles(
        (result ?? []).map(item => ({
          uri: item.uri,
          name: item.name ?? `document-${Date.now()}.pdf`,
          type: item.type,
          size: item.size ?? null,
        })),
      );
    } catch {
      setError('Could not open your documents.');
    }
  };

  const submit = async () => {
    setError(null);
    setNotice(null);

    if (isLocation) {
      const trimmed = locationUrl.trim();
      if (!trimmed) {
        setError('Enter the location URL.');
        return;
      }
      if (!/^https?:\/\//i.test(trimmed)) {
        setError('Enter a full URL, starting with http:// or https://');
        return;
      }

      setProgress(0);
      try {
        await uploadMedia(
          companyId,
          optionId,
          { locationUrl: trimmed },
          setProgress,
        );
        reset();
        onClose();
        await onUploaded();
      } catch (submitError) {
        setError(describeError(submitError));
      } finally {
        setProgress(null);
      }
      return;
    }

    if (files.length === 0) {
      setError('Choose at least one file.');
      return;
    }

    setProgress(0);
    try {
      const result = await uploadMedia(
        companyId,
        optionId,
        { files },
        setProgress,
      );
      if (result.errorCount > 0) {
        // Partial success: the rows that landed stay, the rest are reported.
        setNotice(
          `${result.uploadedCount} file${result.uploadedCount === 1 ? '' : 's'} uploaded, ${result.errorCount} failed.`,
        );
      }
      reset();
      onClose();
      await onUploaded();
    } catch (submitError) {
      setError(describeError(submitError));
    } finally {
      setProgress(null);
    }
  };

  const reset = () => {
    setFiles([]);
    setLocationUrl('');
    setProgress(null);
    setNotice(null);
  };

  const totalBytes = files.reduce((sum, file) => sum + (file.size ?? 0), 0);
  const uploading = progress !== null && progress < 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-white rounded-t-3xl max-h-[92%]">
          <View className="px-5 pt-5 pb-3">
            <Text className="font-lato-black text-lg text-neutral-900">
              Upload {selected?.name ?? 'media'}
            </Text>
            <Text className="font-lato text-xs text-neutral-600 mt-1">
              {isLocation
                ? 'Paste the brand location link.'
                : `Up to ${formatBytes(MAX_MEDIA_BYTES)} per file · ${ALLOWED_MEDIA_EXTENSIONS.join(', ')}`}
            </Text>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            className="px-5">
            {isLocation ? (
              <TextField
                label="Location URL"
                required
                placeholder="https://maps.app.goo.gl/..."
                value={locationUrl}
                onChangeText={setLocationUrl}
                keyboardType="default"
              />
            ) : (
              <>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  <Button
                    title="Images"
                    size="sm"
                    variant="secondary"
                    onPress={() => void pickImages()}
                  />
                  <Button
                    title="Videos"
                    size="sm"
                    variant="secondary"
                    onPress={() => void pickVideo()}
                  />
                  <Button
                    title="PDFs"
                    size="sm"
                    variant="secondary"
                    onPress={() => void pickPdf()}
                  />
                  <Button
                    title="Camera"
                    size="sm"
                    variant="outlined"
                    onPress={async () => {
                      const result = await launchCamera({
                        mediaType: 'photo',
                        includeBase64: false,
                      });
                      if (result.didCancel) {
                        return;
                      }
                      if (result.errorCode) {
                        setError(result.errorMessage ?? 'Camera unavailable.');
                        return;
                      }
                      addFiles(
                        (result.assets ?? []).map(asset => ({
                          uri: asset.uri,
                          name: asset.fileName ?? `photo-${Date.now()}.jpg`,
                          type: asset.type,
                          size: asset.fileSize ?? null,
                        })),
                      );
                    }}
                  />
                </View>

                {files.length > 0 && (
                  <View className="mb-4">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="font-lato-bold text-xs text-neutral-700">
                        {files.length} file{files.length === 1 ? '' : 's'} ·{' '}
                        {formatBytes(totalBytes)}
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setFiles([])}
                        accessibilityRole="button">
                        <Text className="font-lato-bold text-xs text-red-500">
                          Clear
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {files.map((file, index) => (
                      <View
                        key={`${file.uri}-${index}`}
                        className="flex-row items-center gap-2 bg-neutral-200 rounded-xl px-3 py-2 mb-1.5">
                        <Text
                          className="font-lato text-xs text-neutral-900 flex-1"
                          numberOfLines={1}>
                          {file.name}
                        </Text>
                        <Text className="font-lato text-[11px] text-neutral-600">
                          {file.size ? formatBytes(file.size) : ''}
                        </Text>
                        {/* <TouchableOpacity */}
                        {/*   activeOpacity={0.8} */}
                        {/*   onPress={() => */}
                        {/*     setFiles(current => */}
                        {/*       current.filter((_, i) => i !== index), */}
                        {/*     ) */}
                        {/*   } */}
                        {/*   accessibilityRole="button" */}
                        {/*   accessibilityLabel={`Remove ${file.name}`}> */}
                        {/*   <Trash2 size={14} color="#6F778E" /> */}
                        {/* </TouchableOpacity> */}
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {error && (
              <Text className="text-red-500 text-sm font-lato mb-3 leading-5">
                {error}
              </Text>
            )}
            {notice && (
              <View className="mb-3">
                <AlertBanner message={notice} />
              </View>
            )}

            {progress !== null && (
              <View className="mb-3">
                <View className="bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                  <View
                    className="bg-primary-700 h-full rounded-full"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </View>
                <Text className="font-lato text-[11px] text-neutral-600 mt-1">
                  Uploading… {Math.round(progress * 100)}%
                </Text>
              </View>
            )}
          </ScrollView>

          <View className="flex-row gap-3 px-5 pt-2 pb-6">
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
              icon={<Upload size={16} color="#FFFFFF" />}
              onPress={() => void submit()}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function describeError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return error.message || 'The server rejected those files.';
    }
    if (error.status === 500) {
      return 'Every file was rejected. Check the types and try again.';
    }
  }
  return 'Upload failed. Please try again.';
}

const KIND_ICON = {
  image: null,
  video: Video,
  pdf: FileText,
  location: MapPin,
  file: FileText,
} as const;

const KIND_TONE = {
  image: 'bg-tertiary-200',
  video: 'bg-primary-200',
  pdf: 'bg-secondary-200',
  location: 'bg-[#BEFFDB]',
  file: 'bg-neutral-200',
} as const;

function MediaTile({
  file,
  onOpen,
}: {
  file: CompanyMediaFile;
  onOpen: (file: CompanyMediaFile) => void;
}) {
  const Icon = KIND_ICON[file.kind];

  return (
    <View className="bg-white rounded-2xl p-3">
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onOpen(file)}
        className={`rounded-xl overflow-hidden items-center justify-center ${KIND_TONE[file.kind]
          }`}
        style={{ height: 104 }}
        accessibilityRole="button"
        accessibilityLabel={`Open ${file.fileName || file.optionName}`}>
        {file.kind === 'image' ? (
          <Image
            source={{ uri: file.url }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : Icon ? (
          <Icon size={26} color="#3F465C" />
        ) : (
          <MapPin size={26} color="#00A572" />
        )}
      </TouchableOpacity>

      <Text
        className="font-lato-bold text-xs text-neutral-900 mt-2"
        numberOfLines={1}>
        {file.optionName || file.fileName || 'Media'}
      </Text>
      <Text
        className="font-lato text-[11px] text-neutral-600 mt-0.5"
        numberOfLines={1}>
        {file.kind === 'location' ? 'Location link' : file.fileName}
      </Text>

      <View className="flex-row items-center justify-between mt-2">
        <Text className="font-lato text-[10px] text-neutral-500">
          {file.created || '—'}
        </Text>
        {/* Delete is disabled for now. To restore it, add back the */}
        {/* `deleting: boolean` and `onDelete: () => void` props on */}
        {/* MediaTile above and pass them from the call site. */}
        {/* <TouchableOpacity */}
        {/*   activeOpacity={0.8} */}
        {/*   disabled={deleting} */}
        {/*   onPress={onDelete} */}
        {/*   className="w-8 h-8 rounded-full bg-neutral-200 items-center justify-center" */}
        {/*   accessibilityRole="button" */}
        {/*   accessibilityLabel={`Delete ${file.fileName || file.optionName}`}> */}
        {/*   {deleting ? ( */}
        {/*     <ActivityIndicator size="small" color="#6F778E" /> */}
        {/*   ) : ( */}
        {/*     <Trash2 size={14} color="#6F778E" /> */}
        {/*   )} */}
        {/* </TouchableOpacity> */}
      </View>
    </View>
  );
}

export function CompanyMediaScreen() {
  const [companies, setCompanies] = useState<MediaCompany[]>([]);
  const [mediaOptions, setMediaOptions] = useState<MediaOption[]>([]);
  const [dropdownsLoading, setDropdownsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [companyId, setCompanyId] = useState<string | undefined>();
  const [optionId, setOptionId] = useState<string | undefined>();

  const [files, setFiles] = useState<CompanyMediaFile[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  // Both belong to the delete button, which is commented out in MediaTile.
  // Kept so re-enabling it is just uncommenting.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewing, setViewing] = useState<CompanyMediaFile | null>(null);

  /**
   * The pull gesture only. `dropdownsLoading` starts true and is set on every
   * focus, so wiring it to the RefreshControl meant the pull spinner was
   * already spinning before the user could even touch the screen.
   */
  const [pullRefreshing, setPullRefreshing] = useState(false);

  /**
   * Images and videos open in the in-app viewer. PDFs and Brand Locations have
   * no native renderer, so those defer to the OS as before.
   */
  const openFile = useCallback((file: CompanyMediaFile) => {
    if (file.kind === 'image' || file.kind === 'video') {
      setViewing(file);
      return;
    }
    void Linking.openURL(file.url);
  }, []);

  const loadDropdowns = useCallback(async () => {
    setDropdownsLoading(true);
    setError(null);
    try {
      const dropdowns = await fetchMediaDropdowns();
      setCompanies(dropdowns.companies);
      setMediaOptions(dropdowns.mediaOptions);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setDropdownsLoading(false);
    }
  }, []);

  const loadMedia = useCallback(async (id: string) => {
    setMediaLoading(true);
    setMediaError(null);
    try {
      setFiles(await fetchCompanyMedia(id));
    } catch {
      setMediaError('Could not load media for this company.');
    } finally {
      setMediaLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDropdowns();
    }, [loadDropdowns]),
  );

  /** The pull gesture only — the focus fetch is silent. */
  const refresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await loadDropdowns();
    } finally {
      setPullRefreshing(false);
    }
  }, [loadDropdowns]);

  // A company change is what triggers the file list — the media-type picker
  // filters what is already loaded rather than refetching.
  useFocusEffect(
    useCallback(() => {
      if (companyId) {
        void loadMedia(companyId);
      } else {
        setFiles([]);
      }
    }, [companyId, loadMedia]),
  );

  const companyOptions: Option[] = useMemo(
    () =>
      companies.map(company => ({
        value: company.id,
        label: company.name,
      })),
    [companies],
  );

  const mediaTypeOptions: Option[] = useMemo(
    () =>
      mediaOptions.map(option => ({
        value: option.id,
        label: option.name,
      })),
    [mediaOptions],
  );

  const selectedCompany = companies.find(company => company.id === companyId);
  const selectedOption = mediaOptions.find(option => option.id === optionId);

  const visibleFiles = useMemo(
    () =>
      optionId ? files.filter(file => file.optionId === optionId) : files,
    [files, optionId],
  );


  const reset = () => {
    setCompanyId(undefined);
    setOptionId(undefined);
    setMediaError(null);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const confirmDelete = (file: CompanyMediaFile) => {
    // A brand location row only loses its row — the server leaves the URL alone.
    void (async () => {
      setDeletingId(file.mediaId);
      try {
        await deleteMedia(file.mediaId);
        setFiles(current => current.filter(row => row.mediaId !== file.mediaId));
      } catch (deleteError) {
        setMediaError(
          deleteError instanceof ApiError && deleteError.status === 404
            ? 'That file has already been deleted.'
            : 'Could not delete that file.',
        );
      } finally {
        setDeletingId(null);
      }
    })();
  };

  return (
    <DashboardLayout
      title="Company Media"
      subtitle="View and share images/videos/PDFs/locations for companies"
      showMenu
      onRefresh={refresh}
      refreshing={pullRefreshing}>
      <Card className="bg-white rounded-2xl p-4">
        <Text className="font-lato-bold text-lg text-neutral-900 mb-4">
          Select Company &amp; Media Type
        </Text>

        {/* The pickers stay mounted while the dropdowns load. Unmounting them
            made the card collapse and jump on every focus, and hid the labels
            the user was trying to read; each field shows its own spinner and
            opens instantly with a spinner inside instead. */}
        <SelectField
          label="Select Company"
          required
          placeholder="-- Select Company --"
          value={companyId}
          options={companyOptions}
          onChange={setCompanyId}
          searchable
          searchPlaceholder="Search companies"
          loading={dropdownsLoading}
        />
        <SelectField
          label="Media Type"
          placeholder="-- All Media Types --"
          value={optionId}
          options={mediaTypeOptions}
          onChange={setOptionId}
          loading={dropdownsLoading}
        />

        <View className="flex-row gap-3 mt-2">
          <Button
            title="Filter by Type"
            size="lg"
            className="flex-1"
            disabled={!companyId}
            icon={<Filter size={16} color="#FFFFFF" />}
            onPress={() => {
              setOptionId(optionId);
            }}
          />
          <Button
            title="Reset"
            size="lg"
            variant="secondary"
            className="flex-1"
            icon={<RefreshCw size={16} color="#FFFFFF" />}
            onPress={reset}
          />
        </View>

        {error && (
          <Text className="text-red-500 text-sm font-lato mt-3 text-center">
            {error}
          </Text>
        )}
      </Card>

      {/* ---------- Media for the selected company ---------- */}
      {selectedCompany ? (
        <Card className="bg-white rounded-2xl p-4 mt-6">
          <View className="flex-row items-center justify-between gap-3 mb-4">
            <View className="flex-1">
              <Text
                className="font-lato-bold text-base text-neutral-900"
                numberOfLines={1}>
                {selectedCompany.name}
              </Text>
              <Text className="font-lato text-xs text-neutral-600 mt-0.5">
                {selectedOption
                  ? `Showing ${selectedOption.name}`
                  : `${visibleFiles.length} file${visibleFiles.length === 1 ? '' : 's'}`}
              </Text>
            </View>

            {/* <Button */}
            {/*   title="Upload" */}
            {/*   size="sm" */}
            {/*   disabled={!optionId} */}
            {/*   icon={<Upload size={14} color="#FFFFFF" />} */}
            {/*   onPress={() => setUploadOpen(true)} */}
            {/* /> */}
          </View>

          {!optionId && mediaOptions.length > 0 && (
            <View className="bg-tertiary-200 border border-tertiary-300 rounded-2xl px-4 py-3 mb-4 flex-row items-center gap-2.5">
              <Link2 size={18} color="#0081A7" />
              <Text className="font-lato text-sm text-tertiary-900 flex-1 leading-5">
                Choose a media type to upload new files.
              </Text>
            </View>
          )}

          {mediaLoading && visibleFiles.length === 0 ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color="#5279AC" />
            </View>
          ) : mediaError ? (
            <Text className="text-red-500 text-sm font-lato text-center py-4">
              {mediaError}
            </Text>
          ) : visibleFiles.length === 0 ? (
            <View className="items-center py-6">
              <View className="w-14 h-14 rounded-full bg-primary-200 items-center justify-center mb-3">
                <FileText size={22} color="#5279AC" />
              </View>
              <Text className="font-lato-bold text-sm text-neutral-900 text-center">
                No media yet
              </Text>
              <Text className="font-lato text-xs text-neutral-600 text-center mt-1.5 leading-5">
                Upload images, videos or PDFs for this company.
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-3">
              {visibleFiles.map(file => (
                <View key={file.mediaId} style={{ width: '47.5%' }}>
                  <MediaTile file={file} onOpen={openFile} />
                </View>
              ))}
            </View>
          )}
        </Card>
      ) : null}

      <MediaViewer file={viewing} onClose={() => setViewing(null)} />

      <UploadSheet
        visible={uploadOpen}
        companyId={companyId ?? ''}
        optionId={optionId ?? ''}
        mediaOptions={mediaOptions}
        onClose={() => setUploadOpen(false)}
        onUploaded={() =>
          companyId ? loadMedia(companyId) : Promise.resolve()
        }
      />
    </DashboardLayout>
  );
}
