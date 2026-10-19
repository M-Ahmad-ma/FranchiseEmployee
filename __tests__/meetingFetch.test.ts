import {
  fetchAllMeetings,
  fetchMeetings,
  type Meeting,
} from '../src/services/meetingService';

/**
 * `fetchAllMeetings` issues two calls and must survive one of them failing.
 * `Promise.all` would throw away the successful half, which is what made a
 * single failing `status=0` blank the whole Meeting column.
 */

const mockFetch = jest.fn();

jest.mock('../src/services/httpClient', () => {
  const actual = jest.requireActual('../src/services/httpClient');
  return {
    ...actual,
    get: (...args: unknown[]) => mockFetch(...args),
  };
});

const meeting = (id: string): Meeting => ({
  id,
  leadId: '1421',
  status: '1',
  type: '2',
  date: '2026-10-20',
  time: '14:30',
  title: 'Zero Degree',
  brand: 'Mr.COD',
  description: 'Conference call arranged for today.',
  venue: 'conference call',
});

const envelope = (rows: unknown[]) => ({ meetings: rows });

/**
 * A trimmed copy of a real `/meetings` row. The key names are the point: the
 * lead link is `request_id`, the note is `meetiing_desc` (the server's typo), and
 * there is no `firstname`/`lastname` pair to split for a name.
 */
const REAL_ROW = {
  meeting_id: '9238',
  meeting_date: '2026-10-14',
  meeting_time: '16:40',
  meeting_venue: 'zoom meeting',
  meetiing_desc: ' SANA, arrange his zoom meeting for today with kaavi.',
  com_id: '0',
  com_name: 'Kaavi',
  com_contact_person: 'Mr Usman',
  company_contact_no: '0',
  franchisee_name: 'Momin  Khan',
  franchisephoneno: '+923217303049',
  Email: null,
  emp_id: '1546',
  emp_name: 'Sana Khan',
  meeting_fix_date: '2026-10-14 05:58:49',
  meeting_status: '1',
  meeting_type: '3',
  request_id: '34748',
};

describe('normalizeMeeting against a real row', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('reads every field from the keys the server actually sends', async () => {
    mockFetch.mockResolvedValue(envelope([REAL_ROW]));

    const [row] = await fetchMeetings('1');

    expect(row).toMatchObject({
      id: '9238',
      leadId: '34748',
      status: '1',
      type: '3',
      date: '2026-10-14',
      time: '16:40',
      title: 'Momin  Khan',
      brand: 'Kaavi',
      description:
        ' SANA, arrange his zoom meeting for today with kaavi.',
      venue: 'zoom meeting',
    });
  });

  it('joins on request_id, the only lead link the row carries', async () => {
    mockFetch.mockResolvedValue(envelope([REAL_ROW]));

    const [row] = await fetchMeetings('1');
    // The leads table joins on LeadFilterRow.id, which is e_id from the same
    // table — a mismatch here silently blanks the whole Meeting column.
    expect(row.leadId).toBe('34748');
    expect(row.leadId).not.toBe('');
  });
});

describe('fetchAllMeetings', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('combines both statuses', async () => {
    mockFetch
      .mockResolvedValueOnce(envelope([meeting('a')]))
      .mockResolvedValueOnce(envelope([meeting('b')]));

    const result = await fetchAllMeetings();
    expect(result.meetings.map(row => row.id)).toEqual(['a', 'b']);
    expect(result.complete).toBe(true);
  });

  it('keeps the open rows when the closed call fails', async () => {
    mockFetch
      .mockResolvedValueOnce(envelope([meeting('a')]))
      .mockRejectedValueOnce(new Error('boom'));

    const result = await fetchAllMeetings();
    expect(result.meetings.map(row => row.id)).toEqual(['a']);
    expect(result.complete).toBe(false);
  });

  it('keeps the closed rows when the open call fails', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(envelope([meeting('b')]));

    const result = await fetchAllMeetings();
    expect(result.meetings.map(row => row.id)).toEqual(['b']);
    expect(result.complete).toBe(false);
  });

  it('throws only when both calls fail', async () => {
    mockFetch.mockRejectedValue(new Error('boom'));
    await expect(fetchAllMeetings()).rejects.toThrow(/\/meetings failed/);
  });

  it('reports the failure reason so the screen can log it', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetch
      .mockResolvedValueOnce(envelope([meeting('a')]))
      .mockRejectedValueOnce(new Error('403 Forbidden'));

    await fetchAllMeetings();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('403 Forbidden'),
    );
    warn.mockRestore();
  });
});
