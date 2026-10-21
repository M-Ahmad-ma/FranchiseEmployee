import { API_BASE_URL, USE_MOCK } from '../config';
import { get, postForm, uploadMultipart } from './httpClient';
import { delay, pickString, resolveAssetPath } from './utils';
import { LEAD_DETAIL_FIXTURE } from './mockFixtures';
import { logMock } from './mockLogger';
import {
  ALLOWED_IMAGE_EXTENSIONS,
  MAX_LEAD_IMAGE_BYTES,
  type PickedFile,
} from './mediaService';

/**
 * GET /api/team/requests/:id and POST /api/team/leads/info.
 *
 * The three request-detail routes are one handler with optional suffixes:
 * `/company/:company_id` adds the posting company and `/emp/:emp_id` adds the
 * employee's vCard. This always asks for the fullest form, since a detail
 * screen wants all three blocks in one round trip.
 */

export interface LeadComment {
  id: string;
  comment: string;
  created: string;
  employee: string;
}

export interface LeadCompany {
  id: string;
  name: string;
  address: string;
  contact: string;
  website: string;
}

export interface LeadVCard {
  empId: string;
  name: string;
  contact: string;
  email: string;
}

export interface LeadImage {
  id: string;
  title: string;
  /** Raw server path — `public/admin/leads/<file>`. */
  path: string;
  /** Resolved against the API origin, ready for `<Image source>`. */
  url: string;
  created: string;
}

export interface LeadDetail {
  leadId: string;
  investor: string;
  phone: string;
  /** Only some lead sources collect an address alongside the phone. */
  email: string;
  /** Free-text `e_message` the investor typed into the capture form. */
  message: string;
  date: string;
  city: string;
  /** Brand/company name as recorded on the request row. */
  companyName: string;
  dealDone: string;
  meetingType: string;
  /**
   * `meeting_status` — "1" when the lead has a meeting recorded, "0" when it
   * does not. Undocumented in the API spec but present on every lead row, and
   * it answers "does this lead have a meeting" more directly than inferring it
   * from a null `meeting_type`.
   */
  meetingStatus: string;
  pipeline: string;
  comment: string;
  comments: LeadComment[];
  company: LeadCompany | null;
  vcard: LeadVCard | null;
  images: LeadImage[];
}

/**
 * `data` as the three detail routes return it.
 *
 * `requests`, `comments`, `leads_detail`, `categories` and `lead_id` come back on
 * every route, including the shortest one; `company` and `login` only arrive
 * when the matching path segments are supplied. That is why the whole payload is
 * spread into the normalizer instead of just the request row — the comment thread
 * and the free-form detail fields come from the same response as the row itself.
 */
interface LeadDetailPayload {
  requests?: Record<string, unknown>;
  comments?: Record<string, unknown>[];
  leads_detail?: Record<string, unknown>;
  categories?: unknown[];
  lead_id?: string | number;
  company?: Record<string, unknown>;
  login?: Record<string, unknown>;
}

function normalizeImage(row: Record<string, unknown>): LeadImage {
  const path = pickString(row, ['img_path', 'file_path', 'path']);

  return {
    id: pickString(row, ['img_id', 'id', 'media_id']),
    title: pickString(row, ['title', 'caption', 'name']),
    path,
    url: resolveAssetPath(path, API_BASE_URL),
    created: pickString(row, ['created', 'date_created', 'created_at']),
  };
}

function normalizeComment(row: Record<string, unknown>): LeadComment {
  return {
    id: pickString(row, ['comment_id', 'id']),
    comment: pickString(row, ['comment', 'text', 'description']),
    // Lead comments stamp their column `comment_date`, unlike everything else
    // in this API which uses a bare `created`.
    created: pickString(row, ['comment_date', 'created', 'date_created']),
    employee: pickString(row, ['emp_name', 'employee', 'name']),
  };
}

/* -------------------------------------------------------------------------- */
/*  Payload shapes                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Collapses a payload that may be a row or a one-element array into a row.
 *
 * `requests` and `leads_detail` are documented as objects but arrive as
 * single-element arrays. Reading keys straight off the array yields undefined
 * for every field, which renders as a blank screen rather than an error — so
 * both shapes are accepted here instead.
 */
function firstRow(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    return (value[0] ?? {}) as Record<string, unknown>;
  }
  return (value && typeof value === 'object'
    ? value
    : {}) as Record<string, unknown>;
}

/** Same tolerance for the list payloads, which may also arrive unwrapped. */
function toRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value as Record<string, unknown>[];
  }
  return value && typeof value === 'object'
    ? [value as Record<string, unknown>]
    : [];
}

function normalizeLeadDetail(
  leadId: string,
  data: Record<string, unknown>,
): LeadDetail {
  const lead = firstRow(data?.requests);
  const company = data?.company as Record<string, unknown> | undefined;
  const vcard = data?.login as Record<string, unknown> | undefined;

  const first = pickString(lead, ['e_firstname', 'u_firstname']);
  const last = pickString(lead, ['e_lastname', 'u_lastname']);

  return {
    leadId,
    investor: pickString(lead, ['investor', 'e_name']) || `${first} ${last}`.trim(),
    phone: pickString(lead, ['e_phonenumber', 'u_contact', 'contact']),
    // A lead can be captured from a web form that only collected an address.
    email: pickString(lead, ['e_emailaddress', 'u_email', 'email']),
    message: pickString(lead, ['e_message', 'message', 'req_message']),
    date: pickString(lead, ['e_date', 'date']),
    city:
      pickString(lead, ['name', 'city_name', 'city']) ||
      pickString(lead, ['e_city']),
    companyName: pickString(lead, ['co_name', 'lead_name', 'company_name']),
    dealDone: pickString(lead, ['deal_done']),
    meetingType: pickString(lead, ['meeting_type']),
    meetingStatus: pickString(lead, ['meeting_status']),
    pipeline: pickString(lead, ['pipeline']),
    comment: pickString(lead, ['req_comment', 'comment']),
    comments: toRows(data?.comments).map(normalizeComment),
    company: company
      ? {
        id: pickString(company, ['co_id', 'id']),
        name: pickString(company, ['co_name', 'name']),
        address: pickString(company, ['co_address', 'address']),
        contact: pickString(company, ['co_contact', 'contact']),
        website: pickString(company, ['co_website', 'website']),
      }
      : null,
    vcard: vcard
      ? {
        empId: pickString(vcard, ['emp_id', 'u_id']),
        name: pickString(vcard, ['emp_name', 'name']),
        contact: pickString(vcard, ['emp_contact', 'contact']),
        email: pickString(vcard, ['emp_email', 'email']),
      }
      : null,
    // `leads_detail` is `Admin_model->get_leads_detail($id)` — the rows
    // `POST /leads/info` writes, so it holds the lead's attached images. The
    // documented key is `leads_detail`; `lead_media` is kept as a fallback for
    // the older mock fixture shape.
    images: toRows(data?.leads_detail ?? data?.lead_media).map(normalizeImage),
  };
}

/**
 * GET /api/team/requests/:id/company/:company_id/emp/:emp_id — the fullest
 * detail form, which always includes the company block and the vCard.
 *
 * The route suffixes are optional, so company and employee ids are only
 * appended when the lead row carries them.
 *
 * Set USE_MOCK to false to hit the real endpoint.
 */
export async function fetchLeadDetail(leadId: string, e_co_id: string): Promise<LeadDetail> {
  if (USE_MOCK) {
    await delay();
    const result = normalizeLeadDetail(
      leadId,
      LEAD_DETAIL_FIXTURE as Record<string, unknown>,
    );
    logMock(`requests/${leadId}`, result);
    return result;
  }

  const base = await get<LeadDetailPayload>(
    `requests/${encodeURIComponent(leadId)}`,
  );
  const row = firstRow(base?.requests);

  const path = (e_co_id: string) =>
    `requests/${encodeURIComponent(leadId)}/company/${encodeURIComponent(e_co_id)}`;

  const companyId = pickString(row, ['e_co_id', 'co_id']);
  const empId = pickString(row, ['employee_id', 'emp_id']);

  console.log(row, "row")

  let extras: Record<string, unknown> = {};
  try {
    extras =
      companyId && empId
        ? await get<Record<string, unknown>>(`${path(companyId)}/emp/${empId}`)
        : companyId
          ? await get<Record<string, unknown>>(path(companyId))
          : {};
  } catch {
    extras = {};
  }

  console.log(extras, "extras")

  // `base` carries the comment thread and the attached images, which the short
  // route always returns. `requests` is pinned last so the row the ids were
  // resolved from is the one that gets normalized.
  return normalizeLeadDetail(leadId, {
    ...base,
    ...extras,
    requests: row,
  });
}

/**
 * POST /api/team/leads/:id/comments — add a comment to a lead's thread.
 *
 * Lead comments were read-only until this endpoint existed. Form-encoded is
 * simplest here — unlike task comments, this one merges JSON too, so either
 * encoding works.
 *
 * **The 201 response contains only `{ lead_id }`.** It does not return the new
 * comment or its id, so the caller must re-read `GET /requests/:id` and
 * re-render the thread from `data.comments`. Appending optimistically would put
 * a row on screen with no id and no server-assigned timestamp.
 */
export async function addLeadComment(
  leadId: string,
  comment: string,
): Promise<{ leadId: string }> {
  if (USE_MOCK) {
    await delay();
    logMock(`leads/${leadId}/comments`, { comment: comment.trim() });
    return { leadId };
  }

  const data = await postForm<{ lead_id?: string | number }>(
    `leads/${encodeURIComponent(leadId)}/comments`,
    { comment: comment.trim() },
  );

  return { leadId: String(data?.lead_id ?? leadId) };
}

/**
 * POST /api/team/leads/status — the pipeline board toggle.
 *
 * Replaced `POST /properties/status`, which is dead. Despite the old name it was
 * never a property: `leadId` is an `email_history.e_id`, not a property id.
 *
 * Ownership is enforced server-side with a `403`, so the caller deliberately
 * does **not** pre-check a cached assignment flag — it would go stale and either
 * hide a control the employee can still use, or offer one they cannot. Just send
 * it and surface the `403`.
 */
export async function updateLeadStatus(
  leadId: string,
  field: 'pipeline' | 'deal_done',
  status: string,
): Promise<boolean> {
  if (USE_MOCK) {
    await delay();
    logMock(`leads/status ${leadId} ${field}=${status}`, null);
    return true;
  }

  const data = await postForm<{ status?: string } | boolean>('leads/status', {
    id: leadId,
    field,
    status,
  });

  return data === true || (typeof data === 'object' && data?.status === 'success');
}

/** Result of `POST /leads/info` — the row id and the stored path. */
export interface LeadUploadResult {
  leadId: string;
  imagePath: string;
}

/**
 * POST /api/team/leads/info — attach one image to a lead.
 *
 * Multipart, because the model reads `$_FILES`. The server enforces jpg/jpeg/
 * png/gif at 5048KB and randomises the stored filename; this returns the path
 * it recorded so the screen can render the new row without a refetch.
 */
export async function uploadLeadImage(
  leadId: string,
  title: string,
  file: PickedFile,
  onProgress?: (fraction: number) => void,
): Promise<LeadUploadResult> {
  if (!file.uri) {
    throw new Error('The selected image could not be read.');
  }

  if (USE_MOCK) {
    await delay();
    logMock(`leads/info ${leadId} "${title.trim()}"`, { file: file.name });
    return { leadId, imagePath: 'public/admin/leads/mock-upload.jpg' };
  }

  const form = new FormData();
  form.append('lead_id', leadId);
  form.append('title', title.trim());
  form.append('img_file', {
    uri: file.uri,
    name: file.name,
    type: file.type ?? 'image/jpeg',
  } as unknown as Blob);

  const data = await uploadMultipart<{
    lead_id?: string | number;
    img_path?: string;
  }>('leads/info', form, onProgress);

  return {
    leadId: String(data?.lead_id ?? leadId),
    imagePath: data?.img_path ?? '',
  };
}

export { ALLOWED_IMAGE_EXTENSIONS, MAX_LEAD_IMAGE_BYTES };
