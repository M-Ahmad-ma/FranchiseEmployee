import { USE_MOCK } from '../config';
import { get, postForm } from './httpClient';
import { delay, pickString } from './utils';
import { FOLLOWUPS_BELL_FIXTURE, FOLLOWUPS_FIXTURE } from './mockFixtures';
import { logMock } from './mockLogger';

/**
 * GET/POST /api/team/followups — the follow-up queue.
 *
 * This replaces the earlier approach of deriving a queue out of `GET /requests`
 * by excluding terminal pipeline stages. The server owns what counts as an
 * outstanding follow-up, so the app no longer guesses.
 */

export interface FollowUp {
  id: string;
  leadId: string;
  investor: string;
  phone: string;
  company: string;
  city: string;
  /** `YYYY-MM-DD` as sent by the server. */
  date: string;
  /** `HH:mm`, 24-hour. */
  time: string;
  comment: string;
  status: string;
  created: string;
}

export interface FollowUpBell {
  followups: FollowUp[];
  count: number;
}

export interface NewFollowUp {
  leadId: string;
  /** `YYYY-MM-DD` */
  date: string;
  /** `HH:mm`, 24-hour */
  time: string;
  comment: string;
}

/** Active is the default; `all` becomes a NULL filter server-side. */
export type FollowUpStatusFilter = 'active' | 'all' | string;

/**
 * The API documents this list as an empty array, so the keys here are the app's
 * best reading of the web controller's row shape. Every field falls back to an
 * empty string so a rename degrades to a blank cell, not a crash.
 */
function normalizeFollowUp(row: Record<string, unknown>): FollowUp {
  return {
    id: pickString(row, ['followup_id', 'id', 'fup_id']),
    leadId: pickString(row, ['lead_id', 'e_id', 'request_id']),
    investor: pickString(row, ['investor', 'e_name', 'name']),
    phone: pickString(row, ['phone', 'contact', 'e_phonenumber']),
    company: pickString(row, ['company', 'co_name', 'brand']),
    city: pickString(row, ['city', 'city_name']),
    date: pickString(row, ['followup_date', 'date', 'follow_up_date']),
    time: pickString(row, ['followup_time', 'time', 'follow_up_time']),
    comment: pickString(row, ['comment', 'remark', 'description']),
    status: pickString(row, ['status', 'followup_status']),
    created: pickString(row, ['created', 'date_created', 'created_at']),
  };
}

function normalizeList(rows: Record<string, unknown>[] | undefined) {
  return (rows ?? []).map(normalizeFollowUp);
}

/**
 * GET /api/team/followups — follow-ups for the signed-in employee.
 *
 * Set USE_MOCK to false to hit the real endpoint.
 */
export async function fetchFollowups(
  status: FollowUpStatusFilter = 'active',
): Promise<FollowUp[]> {
  if (USE_MOCK) {
    await delay();
    const rows = normalizeList(
      (status === 'all'
        ? FOLLOWUPS_FIXTURE
        : FOLLOWUPS_FIXTURE.filter(row => row.status === 'active')) as Record<
        string,
        unknown
      >[],
    );
    logMock(`followups?status=${status}`, rows);
    return rows;
  }

  const data = await get<{ followups?: Record<string, unknown>[] }>('followups', {
    status,
  });

  return normalizeList(data?.followups);
}

/**
 * GET /api/team/followups/bell — badge count plus the most recent active rows.
 * `limit` falls back to 5 server-side when it is 0 or negative.
 */
export async function fetchFollowupsBell(limit = 5): Promise<FollowUpBell> {
  if (USE_MOCK) {
    await delay();
    const result = {
      followups: normalizeList(
        FOLLOWUPS_BELL_FIXTURE.followups as Record<string, unknown>[],
      ),
      count: FOLLOWUPS_BELL_FIXTURE.count,
    };
    logMock(`followups/bell?limit=${limit}`, result);
    return result;
  }

  const data = await get<{
    followups?: Record<string, unknown>[];
    count?: number;
  }>('followups/bell', { limit });

  return {
    followups: normalizeList(data?.followups),
    count: Number(data?.count ?? 0),
  };
}

/** GET /api/team/followups/:lead_id — every follow-up on one lead. */
export async function fetchLeadFollowups(leadId: string): Promise<FollowUp[]> {
  if (USE_MOCK) {
    await delay();
    const rows = normalizeList(
      FOLLOWUPS_FIXTURE.filter(row => row.lead_id === leadId) as Record<
        string,
        unknown
      >[],
    );
    logMock(`followups/${leadId}`, rows);
    return rows;
  }

  const data = await get<{ followups?: Record<string, unknown>[] }>(
    `followups/${encodeURIComponent(leadId)}`,
  );

  return normalizeList(data?.followups);
}

/**
 * POST /api/team/followups/create — schedule a follow-up.
 *
 * Form-encoded, not JSON: the controller forwards explicit arguments to
 * `add_lead_followup()`, so the field names matter more than the encoding, but
 * multipart/urlencoded is what every sibling write endpoint reads. All four
 * fields are required and a whitespace-only comment is rejected server-side.
 */
export async function createFollowUp(input: NewFollowUp): Promise<boolean> {
  if (USE_MOCK) {
    await delay();
    logMock('followups/create', input);
    return true;
  }

  const data = await postForm<boolean>('followups/create', {
    lead_id: input.leadId,
    followup_date: input.date,
    followup_time: input.time,
    comment: input.comment.trim(),
  });

  return data === true;
}

/**
 * POST /api/team/followups/:id/done — close a follow-up.
 *
 * `id` is the follow-up id, not the lead id. The server carries the ownership
 * check, so this rejects with a 403 when the lead belongs to another employee;
 * callers should surface that as "not your lead", not a generic failure.
 */
export async function markFollowUpDone(id: string): Promise<boolean> {
  if (USE_MOCK) {
    await delay();
    logMock(`followups/${id}/done`, { id });
    return true;
  }

  const data = await postForm<boolean>(
    `followups/${encodeURIComponent(id)}/done`,
    {},
  );

  return data === true;
}