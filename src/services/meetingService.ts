import { USE_MOCK } from '../config';
import { get } from './httpClient';
import { delay, pickString } from './utils';
import { MEETINGS_FIXTURE } from './mockFixtures';
import { logMock } from './mockLogger';

/**
 * GET /api/team/meetings — meetings for the logged-in employee.
 *
 * The documented response is `"meetings": []`, so no row field names are
 * specified. Every reader below takes the first populated value from a list of
 * candidate keys, which keeps each guess confined to one place until the server
 * confirms it. If a rename happens the affected column degrades to an empty
 * cell rather than crashing.
 *
 * Scope note: meetings are scoped to the session's `emp_id` — the same scope as
 * `/leads/filter`. That is what makes a single fetch usable for a whole page of
 * leads, rather than needing one call per row.
 */

export interface Meeting {
  id: string;
  /**
   * The lead this meeting belongs to. This is the join key against
   * `LeadFilterRow.id` (`e_id`), and the only reason a single `/meetings` call
   * can decorate the leads table at all — the endpoint has no `lead_id` filter.
   */
  leadId: string;
  /** Raw status from the row. The API documents `0`/`1` as a filter, not labels. */
  status: string;
  date: string;
  time: string;
  /** Meeting title or category name, when the row carries one. */
  title: string;
}

/** `1` is the documented default for the `status` query param. */
const ACTIVE = '1';
const CLOSED = '0';

function normalizeMeeting(row: Record<string, unknown>): Meeting {
  const first = pickString(row, ['firstname', 'e_firstname', 'f_name']);
  const last = pickString(row, ['lastname', 'e_lastname', 'l_name']);

  return {
    id: pickString(row, ['meeting_id', 'id', 'm_id']),
    leadId: pickString(row, ['lead_id', 'e_id', 'request_id', 'req_id']),
    status: pickString(row, ['status', 'meeting_status']),
    date: pickString(row, ['meeting_date', 'date', 'meet_date', 'm_date']),
    time: pickString(row, ['meeting_time', 'time', 'meet_time']),
    // Falls back to the attendee's name so the cell is never blank on a row the
    // server did give us, though a meeting title is the preferred reading.
    title:
      pickString(row, ['title', 'meeting_title', 'c_name', 'category_name']) ||
      [first, last].filter(Boolean).join(' ').trim(),
  };
}

function normalizeList(rows: Record<string, unknown>[] | undefined): Meeting[] {
  return (rows ?? []).map(normalizeMeeting);
}

export async function fetchMeetings(status?: string): Promise<Meeting[]> {
  if (USE_MOCK) {
    await delay();
    const rows = (
      status === undefined
        ? MEETINGS_FIXTURE
        : MEETINGS_FIXTURE.filter(row => row.status === status)
    ) as Record<string, unknown>[];
    const result = normalizeList(rows);
    logMock(
      `meetings${status === undefined ? '' : `?status=${status}`}`,
      result,
    );
    return result;
  }

  const data = await get<{ meetings?: Record<string, unknown>[] }>(
    'meetings',
    status === undefined ? undefined : { status },
  );

  return normalizeList(data?.meetings);
}

/**
 * Active and closed meetings in one call each.
 *
 * Both are needed: the table has to distinguish a scheduled meeting from one
 * that already happened, and the endpoint returns only one status per call.
 */
export async function fetchAllMeetings(): Promise<Meeting[]> {
  const [active, closed] = await Promise.all([
    fetchMeetings(ACTIVE),
    fetchMeetings(CLOSED),
  ]);

  return [...active, ...closed];
}
