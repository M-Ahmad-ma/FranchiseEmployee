import {
  dealDoneLabel,
  meetingTypeLabel,
  withPipelineNames,
  type LeadFilterRow,
} from '../src/services/leadsFilterService';

describe('withPipelineNames', () => {
  const statuses = [
    { id: '1', name: 'New Lead' },
    { id: '2', name: 'Contacted' },
  ];

  const makeRow = (pipeline: string): LeadFilterRow => ({
    id: '1',
    e_co_id: '',
    investor: 'Ali Khan',
    phone: '',
    cityId: '',
    city: '',
    brandId: '',
    brand: '',
    meetingType: '',
    pipeline,
    pipelineLabel: pipeline,
    dealDone: '',
    date: '',
    comment: '',
  });

  it('replaces the raw status id with its name', () => {
    const [row] = withPipelineNames([makeRow('2')], statuses);
    expect(row.pipelineLabel).toBe('Contacted');
    // The raw id is kept so a future edit can still post it back.
    expect(row.pipeline).toBe('2');
  });

  it('keeps the id as the label when the dropdowns did not return it', () => {
    const [row] = withPipelineNames([makeRow('99')], statuses);
    expect(row.pipelineLabel).toBe('99');
  });

  it('does not mutate the rows it is given', () => {
    const input: LeadFilterRow[] = [
      {
        id: '1',
        e_co_id: '',
        investor: 'Ali Khan',
        phone: '',
        cityId: '',
        city: '',
        brandId: '',
        brand: '',
        meetingType: '',
        pipeline: '2',
        pipelineLabel: '2',
        dealDone: '',
        date: '',
        comment: '',
      },
    ];
    withPipelineNames(input, statuses);
    expect(input[0].pipelineLabel).toBe('2');
  });
});

describe('value labels', () => {
  it('maps the deal_done codes the API documents, including the legacy pair', () => {
    expect(dealDoneLabel('1')).toBe('Yes');
    expect(dealDoneLabel('yes')).toBe('Yes');
    expect(dealDoneLabel('0')).toBe('No');
    expect(dealDoneLabel('no')).toBe('No');
  });

  it('maps the meeting_type codes, and `none` to a distinct label', () => {
    expect(meetingTypeLabel('1')).toBe('In Person');
    expect(meetingTypeLabel('2')).toBe('Video Call');
    expect(meetingTypeLabel('3')).toBe('Phone Call');
    expect(meetingTypeLabel('none')).toBe('Not Set');
  });

  it('returns empty for an unknown code so the cell falls back to a dash', () => {
    expect(dealDoneLabel('7')).toBe('');
    expect(meetingTypeLabel('9')).toBe('');
  });
});