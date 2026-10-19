import {
  withMeetings,
  type LeadFilterRow,
} from '../src/services/leadsFilterService';
import type { Meeting } from '../src/services/meetingService';

/**
 * The join is the part most likely to break silently: a wrong key name yields a
 * table full of "None" rather than an error. These pin the behaviour that must
 * hold regardless of which candidate key the server actually uses.
 */

const lead = (id: string): LeadFilterRow => ({
  id,
  e_co_id: '',
  investor: `Investor ${id}`,
  phone: '',
  cityId: '',
  city: '',
  brandId: '',
  brand: '',
  meetingType: '',
  meetingStatus: '',
  pipeline: '',
  pipelineLabel: '',
  dealDone: '',
  date: '',
  comment: '',
});

const meeting = (over: Partial<Meeting> = {}): Meeting => ({
  id: 'm1',
  leadId: '1421',
  status: '1',
  type: '2',
  date: '2026-10-20',
  time: '14:30',
  title: 'Zero Degree',
  brand: 'Mr.COD',
  description: '',
  venue: 'conference call',
  ...over,
});

describe('withMeetings', () => {
  it('leaves a lead with no meetings at zero rather than undefined', () => {
    const [row] = withMeetings([lead('9999')], [meeting()]);
    expect(row.meetingCount).toBe(0);
    expect(row.nextMeeting).toBeNull();
  });

  it('joins on the lead id', () => {
    const [row] = withMeetings([lead('1421')], [meeting()]);
    expect(row.meetingCount).toBe(1);
    expect(row.nextMeeting?.date).toBe('2026-10-20');
  });

  it('counts every meeting for a lead, not just the one shown', () => {
    const rows = withMeetings(
      [lead('1421')],
      [
        meeting({ id: 'a', date: '2026-10-12' }),
        meeting({ id: 'b', date: '2026-10-20' }),
      ],
    );
    expect(rows[0].meetingCount).toBe(2);
  });

  it('prefers an open meeting over an earlier closed one', () => {
    const [row] = withMeetings(
      [lead('1421')],
      [
        meeting({ id: 'past', status: '0', date: '2026-01-01' }),
        meeting({ id: 'next', status: '1', date: '2026-10-20' }),
      ],
    );
    expect(row.nextMeeting?.id).toBe('next');
  });

  it('falls back to the soonest meeting when they are all closed', () => {
    const [row] = withMeetings(
      [lead('1421')],
      [
        meeting({ id: 'late', status: '0', date: '2026-11-01' }),
        meeting({ id: 'early', status: '0', date: '2026-03-01' }),
      ],
    );
    expect(row.nextMeeting?.id).toBe('early');
  });

  it('skips meetings with no lead id instead of matching a blank key', () => {
    const rows = withMeetings(
      [lead('')],
      [meeting({ id: 'orphan', leadId: '' })],
    );
    expect(rows[0].meetingCount).toBe(0);
  });

  it('does not mutate the rows it is given', () => {
    const input = [lead('1421')];
    withMeetings(input, [meeting()]);
    expect(input[0]).not.toHaveProperty('meetingCount');
  });

  it('is safe when the meetings fetch returned nothing', () => {
    const rows = withMeetings([lead('1421'), lead('1422')], []);
    expect(rows.every(row => row.meetingCount === 0)).toBe(true);
  });
});
