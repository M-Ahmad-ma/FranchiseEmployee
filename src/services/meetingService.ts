import { USE_MOCK } from '../config';
import { get, ApiError, onSessionCleared } from './httpClient';
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
   * The lead this meeting belongs to — `request_id` on the wire, joined against
   * `LeadFilterRow.id` (`e_id`). It is the only reason a single `/meetings` call
   * can decorate the leads table at all, since the endpoint has no lead filter.
   */
  leadId: string;
  /** Raw status from the row. The API documents `0`/`1` as a filter, not labels. */
  status: string;
  /**
   * `meeting_type` on the meeting row, using the same codes as the lead's own
   * column. Read separately because one lead can have meetings of several types,
   * and the meeting's type is the one that belongs next to its date.
   */
  type: string;
  date: string;
  time: string;
  /** Lead's name as recorded on the meeting row (`franchisee_name`). */
  title: string;
  /** Brand or company (`com_name`). */
  brand: string;
  /** The note the employee wrote — `meetiing_desc`, typo included. */
  description: string;
  /** Raw venue text. Inconsistent casing and spacing, so never rendered raw. */
  venue: string;
}

/** `1` is the documented default for the `status` query param. */
const ACTIVE = '1';
const CLOSED = '0';

/**
 * What the two status calls produced together.
 *
 * `complete` is false when only one branch came back, so the screen can report
 * partial data instead of claiming meetings are unavailable.
 */
export interface MeetingsResult {
  meetings: Meeting[];
  complete: boolean;
}

/**
 * Key names below are read off a real `/meetings` response rather than guessed.
 * The documented response is `"meetings": []`, so the fallback candidates stay
 * in place — but the first entry in each list is the one the server actually
 * sends, and `request_id` in particular is promoted to primary because it is
 * what the leads table joins on.
 *
 * `meetiing_desc` is spelled that way on the server; the typo is theirs and is
 * reproduced here deliberately.
 */
function normalizeMeeting(row: Record<string, unknown>): Meeting {
  const name = pickString(row, ['franchisee_name', 'name', 'investor']);

  return {
    id: pickString(row, ['meeting_id', 'id', 'm_id']),
    leadId: pickString(row, ['request_id', 'lead_id', 'e_id', 'req_id']),
    status: pickString(row, ['meeting_status', 'status']),
    type: pickString(row, ['meeting_type', 'type']),
    date: pickString(row, ['meeting_date', 'date', 'meet_date', 'm_date']),
    time: pickString(row, ['meeting_time', 'time', 'meet_time']),
    title: name,
    brand: pickString(row, ['com_name', 'company', 'brand']),
    description: pickString(row, [
      'meetiing_desc',
      'meeting_desc',
      'description',
    ]),
    venue: pickString(row, ['meeting_venue', 'venue']),
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
        : // Filtered on the raw `meeting_status`, matching the shape the server
          // sends rather than the normalised `status`.
          MEETINGS_FIXTURE.filter(row => row.meeting_status === status)
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

  console.log("meetings data", data)

  return normalizeList(data?.meetings);
}

/**
 * Active and closed meetings in one call each.
 *
 * Both are needed: the table has to distinguish a scheduled meeting from one
 * that already happened, and the endpoint returns only one status per call.
 *
 * Settled rather than all: `status=0` is the less-travelled branch and a
 * failure there must not throw away the `status=1` rows we already have. A
 * partial result still renders — the caller is told which half is missing via
 * `MeetingsResult.complete`.
 */
export async function fetchAllMeetings(): Promise<MeetingsResult> {
  const [active, closed] = await Promise.allSettled([
    fetchMeetings(ACTIVE),
    fetchMeetings(CLOSED),
  ]);

  const failures: string[] = [];
  const rows: Meeting[] = [];

  if (active.status === 'fulfilled') {
    rows.push(...active.value);
  } else {
    failures.push(`status=${ACTIVE}: ${describe(active.reason)}`);
  }

  if (closed.status === 'fulfilled') {
    rows.push(...closed.value);
  } else {
    failures.push(`status=${CLOSED}: ${describe(closed.reason)}`);
  }


  if (failures.length === 2) {
    throw new Error(`/meetings failed — ${failures.join('; ')}`);
  }
  if (failures.length === 1) {
    // Logged rather than thrown: the half that worked is still useful, and a
    // banner would wrongly claim the whole column is unavailable.
    console.warn(`[meetings] partial fetch — ${failures.join('; ')}`);
  }

  return { meetings: rows, complete: failures.length === 0 };
}

/**
 * Shared, short-lived cache of the last successful fetch.
 *
 * `/meetings` returns the employee's entire history with no lead filter and no
 * pagination — a few hundred rows. The leads table and the lead detail screen
 * both need it, and neither benefits from fetching it twice. Cleared on
 * sign-out via `clearMeetingsCache`, and skipped on a failed fetch so a
 * transient error cannot poison the cache with an empty list.
 */
let cached: { meetings: Meeting[]; complete: boolean } | null = null;
let inFlight: Promise<MeetingsResult> | null = null;

export function clearMeetingsCache() {
  cached = null;
  inFlight = null;
}

/**
 * `fetchAllMeetings`, deduplicated and memoised for a short window.
 *
 * Both call sites want "the meetings, as recently seen". Refetching 256 rows on
 * every focus and every detail-screen entry is the single largest request in the
 * app, and the data is history — it does not change minute to minute.
 */
export async function fetchAllMeetingsCached(
  maxAgeMs = MEETINGS_CACHE_MS,
): Promise<MeetingsResult> {
  if (cached && Date.now() - cachedAt < maxAgeMs) {
    return cached;
  }
  // Collapse concurrent callers onto one request.
  if (inFlight) {
    return inFlight;
  }

  inFlight = fetchAllMeetings()
    .then(result => {
      cachedAt = Date.now();
      cached =
        result.complete || result.meetings.length > 0 ? result : null;
      inFlight = null;
      return result;
    })
    .catch(error => {
      // Must clear here too, not just on success. Leaving a rejected promise
      // in `inFlight` would hand every later caller the same stale failure
      // without a single network call — the column would be permanently dead.
      inFlight = null;
      throw error;
    });

  return inFlight;
}

let cachedAt = 0;

/** Short enough that a newly logged meeting shows up, long enough to dedupe. */
const MEETINGS_CACHE_MS = 30_000;

// Meetings are scoped to the session's employee, so a sign-out must not leave
// the previous employee's rows in the cache for the next one to read.
onSessionCleared(clearMeetingsCache);

/** Keeps the failure readable in a log line without dumping a whole envelope. */
function describe(reason: unknown) {
  if (reason instanceof ApiError) {
    return `${reason.status} ${reason.message}`;
  }
  return reason instanceof Error ? reason.message : String(reason);
}
