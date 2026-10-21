import { USE_MOCK } from '../config';
import { get, getPaged, MAX_PER_PAGE, type Paged } from './httpClient';
import { delay, pickString } from './utils';
import type { Option } from './utils';
import { logMock } from './mockLogger';
import type { Meeting } from './meetingService';
import {
  LEAD_FILTER_DROPDOWNS_FIXTURE,
  LEAD_FILTER_META_FIXTURE,
  LEAD_FILTER_ROWS_FIXTURE,
} from './mockFixtures';
import { pick } from '@react-native-documents/picker';

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
  /** Raw company id, `e_co_id`. Same value as `brandId`. */
  e_co_id: string;
  investor: string;
  phone: string;
  cityId: string;
  city: string;
  brandId: string;
  brand: string;
  meetingType: string;
  /**
   * `meeting_status` — "1" when the lead has a meeting recorded, "0" when it
   * does not. Undocumented in the API spec but present on every row, and more
   * direct than inferring it from a null `meeting_type`.
   */
  meetingStatus: string;
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
 * `deal_done` accepts `1`/`0` (or the legacy `yes`/`no`).
 */
export const DEAL_DONE_LABELS: Record<string, string> = {
  '1': 'Yes',
  yes: 'Yes',
  '0': 'No',
  no: 'No',
};

/**
 * `meeting_type` codes, taken from the web dashboard's own filter markup:
 *
 *   <select name="meeting_type">
 *     <option value="">All</option>
 *     <option value="none">No Meeting</option>
 *     <option value="1">Physical</option>
 *     <option value="2">Conference Call</option>
 *     <option value="3">Zoom</option>
 *   </select>
 *
 * That markup is the only place these meanings are defined — the API documents
 * just that the column accepts `1`/`2`/`3` or `none`. This app previously
 * guessed "In Person" / "Video Call" / "Phone Call", which contradicted the
 * server: code 2 is Conference Call, and no Phone Call code exists at all.
 */
export const MEETING_TYPE_LABELS: Record<string, string> = {
  '1': 'Physical',
  '2': 'Conference Call',
  '3': 'Zoom',
  'none': 'No Meeting',
};

export const dealDoneLabel = (value: string) =>
  DEAL_DONE_LABELS[value.trim().toLowerCase()] ?? '';

/**
 * An absent `meeting_type` is a NULL column, which the server itself groups
 * under the `none` / "No Meeting" option — so it reads as that rather than as a
 * blank dash.
 */
export const meetingTypeLabel = (value: string) => {
  const key = value.trim().toLowerCase();
  return key ? (MEETING_TYPE_LABELS[key] ?? '') : MEETING_TYPE_LABELS.none;
};

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
    // Same value as `brandId` below. The detail route is only reachable from
    // this row and needs the raw company id — it cannot recover one from the
    // display name — so the snake_case spelling the server uses is kept too.
    e_co_id: pickString(row, ['e_co_id', 'co_id']),
    investor: pickString(row, ['investor', 'name']) || `${first} ${last}`.trim(),
    phone: pickString(row, ['e_phonenumber', 'u_contact', 'phone', 'contact']),
    cityId: pickString(row, ['e_city']),
    // A lead pointing at a deleted city arrives with a null name.
    city: pickString(row, ['city_name', 'city']) || pickString(row, ['e_city']),
    brandId: pickString(row, ['e_co_id']),
    brand: pickString(row, ['co_name', 'brand', 'company_name']),
    meetingType: pickString(row, ['meeting_type']),
    meetingStatus: pickString(row, ['meeting_status']),
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
 *
 * Generic so it can be re-applied to already-joined rows without dropping the
 * meeting fields the screen added.
 */
export function withPipelineNames<T extends LeadFilterRow>(
  rows: T[],
  statuses: PipelineStatus[],
): T[] {
  const byId = new Map(statuses.map(status => [status.id, status.name]));

  return rows.map(row => ({
    ...row,
    pipelineLabel: byId.get(row.pipeline) ?? row.pipelineLabel,
  }));
}

/* -------------------------------------------------------------------------- */
/*  Meeting join                                                                */
/* -------------------------------------------------------------------------- */

/**
 * A lead row plus whatever meetings the server returned for it.
 *
 * `meetingCount` is 0 when the lead has none — and also when the meetings fetch
 * failed, which is why the screen reports that separately rather than inferring
 * it from a column of zeros.
 */
export interface LeadRowWithMeetings extends LeadFilterRow {
  meetingCount: number;
  /** The soonest upcoming meeting, or the most recent one if all are past. */
  nextMeeting: Meeting | null;
}

const timestamp = (meeting: Meeting) =>
  Date.parse(`${meeting.date}T${meeting.time || '00:00'}`) || 0;

/**
 * Open first, then soonest. Undated meetings sort last but are never dropped.
 *
 * `status` "1" is the documented default for the endpoint's `status` query
 * param, so it is read as *open*. Anything unrecognised is treated as open too:
 * guessing wrong here only affects ordering, whereas treating an unknown value
 * as closed would hide a real upcoming meeting behind a grey badge.
 */
function pickPrimary(meetings: Meeting[]): Meeting | null {
  if (meetings.length === 0) {
    return null;
  }

  const isOpen = (meeting: Meeting) => meeting.status !== '0';

  return [...meetings].sort((a, b) => {
    const aDone = isOpen(a) ? 0 : 1;
    const bDone = isOpen(b) ? 0 : 1;
    if (aDone !== bDone) {
      return aDone - bDone;
    }
    return timestamp(a) - timestamp(b);
  })[0];
}

/**
 * The single meeting a lead should be described by: the open one, earliest
 * first, falling back to the soonest closed one. Exported so the lead detail
 * screen describes a lead exactly as the leads table does.
 */
export function pickPrimaryMeeting(meetings: Meeting[]): Meeting | null {
  return pickPrimary(meetings);
}

/** Every meeting recorded against one lead, matched on `request_id`. */
export function meetingsForLead(
  meetings: Meeting[],
  leadId: string,
): Meeting[] {
  if (!leadId) {
    return [];
  }
  return meetings.filter(meeting => meeting.leadId === leadId);
}

/**
 * Decorates leads with their meetings.
 *
 * `/meetings` has no `lead_id` filter, so this joins on the client: one fetch
 * covers the whole table because meetings and leads share the session scope.
 * Meetings whose `leadId` is empty are skipped rather than risking a match
 * against a blank key.
 */
export function withMeetings(
  rows: LeadFilterRow[],
  meetings: Meeting[],
): LeadRowWithMeetings[] {
  const byLead = new Map<string, Meeting[]>();

  for (const meeting of meetings) {
    if (!meeting.leadId) {
      continue;
    }
    const bucket = byLead.get(meeting.leadId);
    if (bucket) {
      bucket.push(meeting);
    } else {
      byLead.set(meeting.leadId, [meeting]);
    }
  }

  return rows.map(row => {
    const found = byLead.get(row.id) ?? [];
    return {
      ...row,
      meetingCount: found.length,
      nextMeeting: pickPrimary(found),
    };
  });
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
 * Pipeline statuses only, memoised briefly.
 *
 * The lead detail screen needs them to label the stage picker, but it has no
 * cities or companies to justify pulling the whole dropdowns payload. These are
 * employee-scoped and change rarely, so one short cache lets it share a fetch
 * with the leads table instead of repeating it on every detail entry.
 */
let pipelineCache: { statuses: PipelineStatus[]; at: number } | null = null;
let pipelineInFlight: Promise<PipelineStatus[]> | null = null;

export function clearPipelineStatusCache() {
  pipelineCache = null;
  pipelineInFlight = null;
}

export async function fetchPipelineStatusesCached(
  maxAgeMs = PIPELINE_CACHE_MS,
): Promise<PipelineStatus[]> {
  if (pipelineCache && Date.now() - pipelineCache.at < maxAgeMs) {
    return pipelineCache.statuses;
  }
  if (pipelineInFlight) {
    return pipelineInFlight;
  }

  pipelineInFlight = fetchLeadFilterDropdowns()
    .then(result => {
      pipelineCache = { statuses: result.pipelineStatuses, at: Date.now() };
      pipelineInFlight = null;
      return result.pipelineStatuses;
    })
    .catch(error => {
      // Same reasoning as the meetings cache: a rejected inFlight promise would
      // be replayed to every later caller with no network call at all.
      pipelineInFlight = null;
      throw error;
    });

  return pipelineInFlight;
}

const PIPELINE_CACHE_MS = 60_000;

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
