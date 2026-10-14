import { API_BASE_URL, USE_MOCK } from '../config';
import { get, postForm, uploadMultipart } from './httpClient';
import { delay, pickString, resolveAssetPath } from './utils';
import {
  COMPANY_MEDIA_FIXTURE,
  MEDIA_DROPDOWNS_FIXTURE,
} from './mockFixtures';
import { logMock } from './mockLogger';

/**
 * GET/POST /api/team/media — company media management.
 *
 * Files live at `uploads/company_media/<file>` relative to the server root, so
 * `file_path` has to be resolved against the API origin before it will render.
 * Brand Location rows store an absolute URL instead and are left untouched.
 */

/** Types the server accepts. Anything else is rejected before upload. */
export const ALLOWED_MEDIA_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'mp4',
  'avi',
  'mov',
  'webm',
  'pdf',
];

/** Images the server accepts for `POST /leads/info`. */
export const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif'];

/**
 * The server's `max_size` is 0 — unlimited — so this is the only limit in the
 * path. Enforced on the client to stop a multi-gigabyte video reaching the
 * uploads directory.
 */
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

/** `POST /leads/info` caps uploads at 5048 KB server-side. */
export const MAX_LEAD_IMAGE_BYTES = 5048 * 1024;

/**
 * Sending this literal `option_name` makes the upload endpoint store a
 * `location_url` instead of a file. It is a magic value, not a lookup.
 */
export const BRAND_LOCATION_OPTION = 'Brand Location';

export interface MediaOption {
  id: string;
  name: string;
}

export interface MediaCompany {
  id: string;
  name: string;
}

export interface MediaDropdowns {
  companies: MediaCompany[];
  mediaOptions: MediaOption[];
}

export interface CompanyMediaFile {
  mediaId: string;
  companyId: string;
  optionId: string;
  optionName: string;
  fileName: string;
  /** Raw server path — relative for files, absolute for Brand Location. */
  filePath: string;
  /** `filePath` resolved against the API origin, ready to render or open. */
  url: string;
  /** True when the row is a Brand Location URL rather than an upload. */
  isLocation: boolean;
  kind: MediaKind;
  created: string;
}

export type MediaKind = 'image' | 'video' | 'pdf' | 'location' | 'file';

export interface UploadResult {
  uploaded: { media_id?: number; mediaId: string; fileName: string }[];
  uploadedCount: number;
  errorCount: number;
  errors: string[];
  /** Set when a Brand Location URL was stored instead of a file. */
  mediaId?: string;
}

function normalizeCompany(row: Record<string, unknown>): MediaCompany {
  return {
    id: pickString(row, ['co_id', 'id', 'company_id']),
    name: pickString(row, ['co_name', 'name', 'company_name']),
  };
}

function normalizeOption(row: Record<string, unknown>): MediaOption {
  return {
    id: pickString(row, ['option_id', 'id', 'media_option_id']),
    name: pickString(row, ['option_name', 'name']),
  };
}

export function extensionOf(name: string): string {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

/** Classifies a row so the screen knows which preview to draw. */
export function mediaKind(filePath: string, optionName = ''): MediaKind {
  if (/^https?:\/\//i.test(filePath)) {
    return 'location';
  }
  if (optionName === BRAND_LOCATION_OPTION) {
    return 'location';
  }

  switch (extensionOf(filePath)) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return 'image';
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'webm':
      return 'video';
    case 'pdf':
      return 'pdf';
    default:
      return 'file';
  }
}

function normalizeMediaFile(
  row: Record<string, unknown>,
): CompanyMediaFile {
  const filePath = pickString(row, ['file_path', 'path', 'url']);
  const optionName = pickString(row, ['option_name', 'media_option']);

  return {
    mediaId: pickString(row, ['media_id', 'id']),
    companyId: pickString(row, ['company_id', 'co_id']),
    optionId: pickString(row, ['option_id']),
    optionName,
    fileName: pickString(row, ['file_name', 'name']),
    filePath,
    url: resolveAssetPath(filePath, API_BASE_URL),
    isLocation: /^https?:\/\//i.test(filePath),
    kind: mediaKind(filePath, optionName),
    created: pickString(row, ['created', 'date_created', 'created_at']),
  };
}

/* -------------------------------------------------------------------------- */
/*  Validation                                                                 */
/* -------------------------------------------------------------------------- */

export interface FileCheck {
  ok: boolean;
  reason?: string;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Shared check for a file about to be uploaded. */
export function validateFile(
  fileName: string,
  bytes: number | null,
  maxBytes: number,
  allowedExtensions: string[],
): FileCheck {
  const extension = extensionOf(fileName);
  if (!allowedExtensions.includes(extension)) {
    return {
      ok: false,
      reason: `${fileName} is a .${extension || 'unknown'} file. Allowed: ${allowedExtensions.join(', ')}.`,
    };
  }
  if (bytes !== null && bytes > maxBytes) {
    return {
      ok: false,
      reason: `${fileName} is ${formatBytes(bytes)} — the limit is ${formatBytes(maxBytes)}.`,
    };
  }
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Endpoints                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/team/media — the company and media-type pickers.
 *
 * This replaces `GET /api/team/companies` for this screen: it returns the
 * companies *and* the `option_id` values the upload endpoint needs, so the
 * static media-type list is no longer required.
 *
 * Set USE_MOCK to false to hit the real endpoint.
 */
export async function fetchMediaDropdowns(): Promise<MediaDropdowns> {
  if (USE_MOCK) {
    await delay();
    const result = {
      companies: MEDIA_DROPDOWNS_FIXTURE.all_companies.map(row =>
        normalizeCompany(row as Record<string, unknown>),
      ),
      mediaOptions: MEDIA_DROPDOWNS_FIXTURE.all_media_options.map(row =>
        normalizeOption(row as Record<string, unknown>),
      ),
    };
    logMock('media', result);
    return result;
  }

  const data = await get<{
    all_companies?: Record<string, unknown>[];
    all_media_options?: Record<string, unknown>[];
  }>('media');

  return {
    companies: (data?.all_companies ?? [])
      .map(normalizeCompany)
      .filter(company => company.id !== '' && company.name !== ''),
    mediaOptions: (data?.all_media_options ?? [])
      .map(normalizeOption)
      .filter(option => option.id !== '' && option.name !== ''),
  };
}

/** GET /api/team/media/company/:company_id — the files stored for one company. */
export async function fetchCompanyMedia(
  companyId: string,
): Promise<CompanyMediaFile[]> {
  if (USE_MOCK) {
    await delay();
    const rows = COMPANY_MEDIA_FIXTURE.media_files.map(row =>
      normalizeMediaFile(row as Record<string, unknown>),
    );
    logMock(`media/company/${companyId}`, rows);
    return rows;
  }

  const data = await get<{ media_files?: Record<string, unknown>[] }>(
    `media/company/${encodeURIComponent(companyId)}`,
  );

  return (data?.media_files ?? []).map(normalizeMediaFile);
}

/** One picked file, already narrowed to the fields the upload needs. */
export interface PickedFile {
  /**
   * Optional because both pickers type it that way, but a row without one
   * cannot be appended to a FormData — `addFiles` filters those out.
   */
  uri?: string;
  name: string;
  type?: string | null;
  size?: number | null;
}

/** Appends files under `media_files[]`, the key the model reads. */
function appendFiles(form: FormData, files: PickedFile[]) {
  files.forEach(file => {
    if (!file.uri) {
      return;
    }
    form.append('media_files[]', {
      uri: file.uri,
      name: file.name,
      type: file.type ?? 'application/octet-stream',
    } as unknown as Blob);
  });
}

function appendLocation(form: FormData, companyId: string, optionId: string, url: string) {
  form.append('company_id', companyId);
  form.append('option_id', optionId);
  form.append('option_name', BRAND_LOCATION_OPTION);
  form.append('location_url', url);
}

/**
 * POST /api/team/media/upload — multipart; the model reads `$_FILES` directly.
 *
 * Two modes on one endpoint. With `locationUrl`, the row stores a Brand
 * Location and returns a single `media_id`. With `files`, it loops the batch and
 * can return partial success, so the result reports both counts and any
 * per-file errors.
 */
export async function uploadMedia(
  companyId: string,
  optionId: string,
  payload: { files?: PickedFile[]; locationUrl?: string },
  onProgress?: (fraction: number) => void,
): Promise<UploadResult> {
  if (USE_MOCK) {
    await delay();
    const uploaded = (payload.files ?? []).map((file, index) => ({
      mediaId: String(600 + index),
      fileName: file.name,
    }));
    const result = {
      uploaded,
      uploadedCount: uploaded.length,
      errorCount: 0,
      errors: [] as string[],
      mediaId: payload.locationUrl ? '700' : undefined,
    };
    logMock(
      `media/upload (${payload.locationUrl ? 'location' : `${uploaded.length} file(s)`})`,
      payload.locationUrl ? payload.locationUrl : uploaded,
    );
    return result;
  }

  const form = new FormData();

  if (payload.locationUrl) {
    appendLocation(form, companyId, optionId, payload.locationUrl);
  } else {
    form.append('company_id', companyId);
    form.append('option_id', optionId);
    appendFiles(form, payload.files ?? []);
  }

  const data = await uploadMultipart<{
    uploaded?: { media_id?: number; mediaId?: string; file_name?: string }[];
    uploaded_count?: number;
    error_count?: number;
    errors?: string[];
    media_id?: number;
  }>('media/upload', form, onProgress);

  const uploaded = (data?.uploaded ?? []).map(row => ({
    mediaId: String(row.media_id ?? row.mediaId ?? ''),
    fileName: pickString(row, ['file_name', 'fileName']),
  }));

  return {
    uploaded,
    uploadedCount: data?.uploaded_count ?? uploaded.length,
    errorCount: data?.error_count ?? 0,
    errors: data?.errors ?? [],
    mediaId: data?.media_id !== undefined ? String(data.media_id) : undefined,
  };
}

/**
 * POST /api/team/media/delete/:media_id — drop one media row.
 *
 * The server unlinks the file from disk only when `file_path` is not an
 * `http(s)://` URL, so Brand Location rows lose their row and nothing else.
 */
export async function deleteMedia(mediaId: string): Promise<boolean> {
  if (USE_MOCK) {
    await delay();
    logMock(`media/delete/${mediaId}`, { mediaId });
    return true;
  }

  const data = await postForm<boolean>(
    `media/delete/${encodeURIComponent(mediaId)}`,
    {},
  );

  return data === true;
}