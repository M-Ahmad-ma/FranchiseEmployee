import { API_BASE_URL, USE_MOCK } from '../config';
import { get, uploadMultipart } from './httpClient';
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
  date: string;
  dealDone: string;
  meetingType: string;
  pipeline: string;
  comment: string;
  /** Free-form `leads_detail` fields, kept as-is so nothing is dropped. */
  detail: Record<string, string>;
  comments: LeadComment[];
  company: LeadCompany | null;
  vcard: LeadVCard | null;
  images: LeadImage[];
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
    created: pickString(row, ['created', 'date_created']),
    employee: pickString(row, ['emp_name', 'employee', 'name']),
  };
}

/**
 * Every scalar out of a row, so `leads_detail` can be rendered as a list
 * without this file needing to know the server's column names.
 */
function scalarFields(row: Record<string, unknown> | undefined) {
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(row ?? {})) {
    if (value !== null && value !== undefined && typeof value !== 'object') {
      const text = String(value).trim();
      if (text !== '') {
        fields[key] = text;
      }
    }
  }
  return fields;
}

function normalizeLeadDetail(
  leadId: string,
  data: Record<string, unknown>,
): LeadDetail {
  const lead = (data?.requests ?? {}) as Record<string, unknown>;
  const company = data?.company as Record<string, unknown> | undefined;
  const vcard = data?.login as Record<string, unknown> | undefined;

  const first = pickString(lead, ['e_firstname', 'u_firstname']);
  const last = pickString(lead, ['e_lastname', 'u_lastname']);

  return {
    leadId,
    investor: pickString(lead, ['investor', 'e_name']) || `${first} ${last}`.trim(),
    phone: pickString(lead, ['e_phonenumber', 'u_contact', 'contact']),
    date: pickString(lead, ['e_date', 'date']),
    dealDone: pickString(lead, ['deal_done']),
    meetingType: pickString(lead, ['meeting_type']),
    pipeline: pickString(lead, ['pipeline']),
    comment: pickString(lead, ['req_comment', 'comment']),
    detail: scalarFields(data?.leads_detail as Record<string, unknown>),
    comments: (
      (data?.comments as Record<string, unknown>[] | undefined) ?? []
    ).map(normalizeComment),
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
    images: (
      (data?.lead_media as Record<string, unknown>[] | undefined) ?? []
    ).map(normalizeImage),
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
export async function fetchLeadDetail(leadId: string): Promise<LeadDetail> {
  if (USE_MOCK) {
    await delay();
    const result = normalizeLeadDetail(
      leadId,
      LEAD_DETAIL_FIXTURE as Record<string, unknown>,
    );
    logMock(`requests/${leadId}`, result);
    return result;
  }

  const lead = await get<{ requests?: Record<string, unknown> }>(
    `requests/${encodeURIComponent(leadId)}`,
  );
  const row = (lead?.requests ?? {}) as Record<string, unknown>;

  const path = (id: string) =>
    `requests/${encodeURIComponent(leadId)}/company/${encodeURIComponent(id)}`;

  const companyId = pickString(row, ['e_co_id', 'co_id']);
  const empId = pickString(row, ['employee_id', 'emp_id']);

  // One more call for the company + vCard blocks, skipped when the lead has
  // neither — the short route already returned everything it can.
  const extras =
    companyId && empId
      ? await get<Record<string, unknown>>(`${path(companyId)}/emp/${empId}`)
      : companyId
        ? await get<Record<string, unknown>>(path(companyId))
        : {};

  return normalizeLeadDetail(leadId, {
    requests: row,
    ...extras,
    lead_media: extras.lead_media ?? [],
  });
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