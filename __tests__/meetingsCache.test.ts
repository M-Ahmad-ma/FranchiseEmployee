import {
  fetchAllMeetings,
  fetchAllMeetingsCached,
  clearMeetingsCache,
  type Meeting,
} from '../src/services/meetingService';
import { meetingsForLead, pickPrimaryMeeting } from '../src/services/leadsFilterService';

/**
 * Two things worth pinning:
 *
 * 1. `/meetings` returns the employee's whole history with no lead filter, and
 *    both the leads table and the lead detail screen need it. Without the cache
 *    the detail screen refetches a few hundred rows on every entry.
 * 2. The detail screen describes a lead by `pickPrimaryMeeting` so it agrees
 *    with the badge on the leads table.
 */

const mockFetch = jest.fn();

jest.mock('../src/services/httpClient', () => {
  const actual = jest.requireActual('../src/services/httpClient');
  return {
    ...actual,
    get: (...args: unknown[]) => mockFetch(...args),
  };
});

const meeting = (over: Record<string, unknown> = {}) => ({
  meeting_id: '1',
  request_id: '1421',
  meeting_status: '1',
  meeting_type: '3',
  meeting_date: '2026-10-20',
  meeting_time: '14:30',
  meeting_venue: 'zoom meeting',
  franchisee_name: 'Ali Khan',
  ...over,
});

describe('meetings cache', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    clearMeetingsCache();
  });

  it('fetches once and serves the second caller from cache', async () => {
    mockFetch.mockResolvedValue({ meetings: [meeting()] });

    await fetchAllMeetingsCached();
    await fetchAllMeetingsCached();

    // Two statuses per fetch, once. A second pass would be four calls.
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('collapses concurrent callers onto one request', async () => {
    mockFetch.mockResolvedValue({ meetings: [meeting()] });

    await Promise.all([fetchAllMeetingsCached(), fetchAllMeetingsCached()]);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('refetches once the cache window has passed', async () => {
    mockFetch.mockResolvedValue({ meetings: [meeting()] });

    await fetchAllMeetingsCached();
    // A zero window is always stale.
    await fetchAllMeetingsCached(0);

    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('does not cache a total failure, so the next caller retries', async () => {
    mockFetch.mockRejectedValue(new Error('boom'));

    await expect(fetchAllMeetingsCached()).rejects.toThrow();

    // The point is that this second call reaches the network at all. Before the
    // inFlight guard was cleared on rejection it replayed the first failure
    // forever without a request. Four calls total: two for the failed attempt
    // (one per status), two for the retry.
    mockFetch.mockResolvedValue({ meetings: [meeting()] });
    const result = await fetchAllMeetingsCached();

    expect(result.complete).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});

const normalized = (over: Partial<Meeting> = {}): Meeting => ({
  id: '1',
  leadId: '1421',
  status: '1',
  type: '3',
  date: '2026-10-20',
  time: '14:30',
  title: 'Ali Khan',
  brand: 'Mr.COD',
  description: '',
  venue: 'zoom meeting',
  ...over,
});

describe('meetingsForLead', () => {
  it('matches on request_id', () => {
    const rows = [
      normalized({ id: '1', leadId: '1421' }),
      normalized({ id: '2', leadId: '9999', type: '1' }),
    ];

    expect(meetingsForLead(rows, '1421')).toHaveLength(1);
  });

  it('returns nothing for a blank lead id rather than matching stray rows', () => {
    const rows = [normalized({ id: '1', leadId: '' })];

    expect(meetingsForLead(rows, '')).toEqual([]);
  });
});

describe('pickPrimaryMeeting', () => {
  const m = (over: Partial<Meeting>) => normalized(over);

  it('is null when the lead has none', () => {
    expect(pickPrimaryMeeting([])).toBeNull();
  });

  it('prefers an open meeting over an earlier closed one', () => {
    const picked = pickPrimaryMeeting([
      m({ id: 'past', status: '0', date: '2026-01-01' }),
      m({ id: 'next', status: '1', date: '2026-10-20' }),
    ]);
    expect(picked?.id).toBe('next');
  });
});

describe('fetchAllMeetings remains uncached', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    clearMeetingsCache();
  });

  it('always hits the network', async () => {
    mockFetch.mockResolvedValue({ meetings: [meeting()] });

    await fetchAllMeetings();
    await fetchAllMeetings();

    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});
