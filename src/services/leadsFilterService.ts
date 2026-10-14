import { USE_MOCK } from '../config';
import { get, getPaged, MAX_PER_PAGE, type Paged } from './httpClient';
import { delay, pickString } from './utils';
import type { Option } from './utils';
import { logMock } from './mockLogger';
import {
  LEAD_FILTER_DROPDOWNS_FIXTURE,
  LEAD_FILTER_META_FIXTURE,
  LEAD_FILTER_ROWS_FIXTURE,
} from './mockFixtures';

/**
 * GET /api/team/leads/filter and its dropdown sources.
 *
 * This replaces the old `/requests` + in-memory filtering: the filter endpoint
 * filters on the server and is the only endpoint in the Team API that pages,
 * so everything the screen showed as "filtered" is now the server's answer.
 *
 * The employee is never a parameter — the controller always scopes to the
 * session's `emp_id`, so there is no cross-employee view to offer.
 */

export interface LeadFilterParams {
  /** `cities.id` */
  city?: string;
  /** `companies.co_id` */
  brand?: string;
  /** Free text over first name, last name and phone number. */
  investor?: string;
  dealDone?: string;
  meetingType?: string;
  /** Pipeline status id, from the dropdowns endpoint. */
  pipeline?: string;
  /** `YYYY-MM-DD` — converted from the date picker's display format. */
  startDate?: string;
  /** `YYYY-MM-DD` */
  endDate?: string;
  /** Matches `req_comment` or any comment on the lead. */
  commentSearch?: string;
  page?: number;
  perPage?: number;
}

export interface LeadFilterRow {
  id: string;
  investor: string;
  phone: string;
  cityId: string;
  city: string;
  brandId: string;
  brand: string;
  meetingType: string;
  /** Raw pipeline status id. */
  pipeline: string;
  /** Resolved status name; falls back to the id when the lookup misses. */
  pipelineLabel: string;
  dealDone: string;
  date: string;
  comment: string;
}

export interface PipelineStatus {
  id: string;
  name: string;
}

export interface LeadFilterDropdowns {
  cities: Option[];
  companies: Option[];
  pipelineStatuses: PipelineStatus[];
}

/* -------------------------------------------------------------------------- */
/*  Value labels                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The API documents these as codes, not names: `deal_done` accepts `1`/`0` (or
 * legacy `yes`/`no`) and `meeting_type` accepts `1`/`2`/`3` (or `none`). It
 * never says what `1`/`2`/`3` mean, so these labels are this app's assumption
 * carried over from the reference lists — change them here, in one place, if
 * the server defines the codes differently.
 */
export const DEAL_DONE_LABELS: Record<string, string> = {
  '1': 'Yes',
  yes: 'Yes',
  '0': 'No',
  no: 'No',
};

export const MEETING_TYPE_LABELS: Record<string, string> = {
  '1': 'In Person',
  '2': 'Video Call',
  '3': 'Phone Call',
  none: 'Not Set',
};

export const dealDoneLabel = (value: string) =>
  DEAL_DONE_LABELS[value.trim().toLowerCase()] ?? '';

export const meetingTypeLabel = (value: string) =>
  MEETING_TYPE_LABELS[value.trim().toLowerCase()] ?? '';

/* -------------------------------------------------------------------------- */
/*  Normalisers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The filter response is the one list in the Team API documented with real
 * keys (`e_id`, `co_name`, `city_name`, …), so those lead. The fallback keys
 * exist only so a field rename on the server degrades to an empty cell rather
 * than an undefined crash.
 */
function normalizeLead(row: Record<string, unknown>): LeadFilterRow {
  const first = pickString(row, ['e_firstname']);
  const last = pickString(row, ['e_lastname']);
  const pipeline = pickString(row, ['pipeline', 'pipeline_status']);

  return {
    id: pickString(row, ['e_id', 'id', 'lead_id']),
    investor: pickString(row, ['investor', 'name']) || `${first} ${last}`.trim(),
    phone: pickString(row, ['e_phonenumber', 'u_contact', 'phone', 'contact']),
    cityId: pickString(row, ['e_city']),
    // A lead pointing at a deleted city arrives with a null name.
    city: pickString(row, ['city_name', 'city']) || pickString(row, ['e_city']),
    brandId: pickString(row, ['e_co_id']),
    brand: pickString(row, ['co_name', 'brand', 'company_name']),
    meetingType: pickString(row, ['meeting_type']),
    pipeline,
    pipelineLabel: pipeline,
    dealDone: pickString(row, ['deal_done', 'deals_done']),
    date: pickString(row, ['e_date', 'date']),
    comment: pickString(row, ['req_comment', 'comment', 'comments']),
  };
}

/** The dropdown endpoints document empty arrays, so keys are guessed here. */
function normalizeOptions(
  rows: Record<string, unknown>[] | undefined,
  idKeys: string[],
  nameKeys: string[],
): Option[] {
  return (rows ?? [])
    .map(row => ({
      value: pickString(row, idKeys),
      label: pickString(row, nameKeys),
    }))
    .filter(option => option.value !== '' && option.label !== '');
}

function normalizePipelineStatuses(
  rows: Record<string, unknown>[] | undefined,
): PipelineStatus[] {
  return (rows ?? [])
    .map(row => ({
      id: pickString(row, ['id', 'status_id', 'pipeline_id']),
      name: pickString(row, ['name', 'status_name', 'pipeline_name']),
    }))
    .filter(status => status.id !== '' && status.name !== '');
}

/* -------------------------------------------------------------------------- */
/*  Queries                                                                    */
/* -------------------------------------------------------------------------- */

function toQuery(params: LeadFilterParams) {
  return {
    city: params.city,
    brand: params.brand,
    investor: params.investor?.trim(),
    deal_done: params.dealDone,
    meeting_type: params.meetingType,
    pipeline: params.pipeline,
    start_date: params.startDate,
    end_date: params.endDate,
    comment_search: params.commentSearch?.trim(),
    page: params.page ?? 1,
    per_page: Math.min(params.perPage ?? 20, MAX_PER_PAGE),
  };
}

/**
 * Joins each row's pipeline id to its display name. Rows carrying an id the
 * dropdowns endpoint didn't return keep the id as their label rather than
 * rendering blank.
 */
export function withPipelineNames(
  rows: LeadFilterRow[],
  statuses: PipelineStatus[],
): LeadFilterRow[] {
  const byId = new Map(statuses.map(status => [status.id, status.name]));

  return rows.map(row => ({
    ...row,
    pipelineLabel: byId.get(row.pipeline) ?? row.pipelineLabel,
  }));
}

/* -------------------------------------------------------------------------- */
/*  Endpoints                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/team/leads/filter/dropdowns — city, company and pipeline pickers in
 * one call, so the filter screen never needs a second round trip to render.
 *
 * Set USE_MOCK to false to hit the real endpoint.
 */
export async function fetchLeadFilterDropdowns(): Promise<LeadFilterDropdowns> {
  if (USE_MOCK) {
    const result = {
      cities: LEAD_FILTER_DROPDOWNS_FIXTURE.cities,
      companies: LEAD_FILTER_DROPDOWNS_FIXTURE.companies,
      pipelineStatuses: LEAD_FILTER_DROPDOWNS_FIXTURE.pipelineStatuses,
    };
    logMock('leads/filter/dropdowns', result);
    return result;
  }

  const data = await get<{
    cities?: Record<string, unknown>[];
    companies?: Record<string, unknown>[];
    pipeline_statuses?: Record<string, unknown>[];
  }>('leads/filter/dropdowns');

  return {
    cities: normalizeOptions(
      data?.cities,
      ['id', 'city_id'],
      ['name', 'city_name'],
    ),
    companies: normalizeOptions(
      data?.companies,
      ['id', 'co_id', 'company_id'],
      ['name', 'co_name', 'company_name'],
    ),
    pipelineStatuses: normalizePipelineStatuses(data?.pipeline_statuses),
  };
}

/**
 * GET /api/team/leads/filter — leads assigned to this employee, filtered and
 * paginated server-side. Returns the page alongside the pagination block.
 */
export async function fetchFilteredLeads(
  params: LeadFilterParams = {},
): Promise<Paged<{ leads: LeadFilterRow[]; total: number }>> {
  if (USE_MOCK) {
    await delay();
    const result = {
      data: {
        leads: LEAD_FILTER_ROWS_FIXTURE.map(row =>
          normalizeLead(row as Record<string, unknown>),
        ),
        total: LEAD_FILTER_META_FIXTURE.total,
      },
      meta: LEAD_FILTER_META_FIXTURE,
    };
    logMock(
      `leads/filter ${JSON.stringify(toQuery(params))}`,
      result.data.leads,
    );
    return result;
  }

  const query = toQuery(params);
  const { data, meta } = await getPaged<{
    leads?: Record<string, unknown>[];
    total?: number;
  }>('leads/filter', query);

  return {
    data: {
      leads: (data?.leads ?? []).map(normalizeLead),
      total: data?.total ?? meta.total,
    },
    meta,
  };
}