import { addLeadComment, updateLeadStatus } from '../src/services/leadDetailService';

/**
 * Both endpoints are new in the latest batch. Two behaviours matter more than
 * the request shape and are easy to get wrong:
 *
 * 1. `POST /leads/:id/comments` returns only `{ lead_id }` — no id, no text, no
 *    timestamp. A caller that appends locally produces a row the server never
 *    created, with no id to key on.
 * 2. Both enforce ownership with a 403, and neither should be pre-checked against
 *    a cached assignment flag — the server is the only authority on it.
 */

const mockPostForm = jest.fn();

jest.mock('../src/services/httpClient', () => {
  const actual = jest.requireActual('../src/services/httpClient');
  return {
    ...actual,
    postForm: (...args: unknown[]) => mockPostForm(...args),
    get: jest.fn(),
  };
});

describe('addLeadComment', () => {
  beforeEach(() => mockPostForm.mockReset());

  it('posts to the lead-scoped path with a form field', async () => {
    mockPostForm.mockResolvedValue({ lead_id: 1421 });

    await addLeadComment('1421', 'Called the investor');

    expect(mockPostForm).toHaveBeenCalledWith('leads/1421/comments', {
      comment: 'Called the investor',
    });
  });

  it('trims before sending, since the server rejects whitespace-only', async () => {
    mockPostForm.mockResolvedValue({ lead_id: 1421 });

    await addLeadComment('1421', '   spaced out \n');

    expect(mockPostForm.mock.calls[0][1]).toEqual({
      comment: 'spaced out',
    });
  });

  it('encodes the id so a stray slash cannot escape the path', async () => {
    mockPostForm.mockResolvedValue({ lead_id: 1 });

    await addLeadComment('a/b', 'hi');

    expect(mockPostForm.mock.calls[0][0]).toBe('leads/a%2Fb/comments');
  });

  it('returns only the lead id — the 201 carries nothing else', async () => {
    mockPostForm.mockResolvedValue({ lead_id: 1421 });

    const result = await addLeadComment('1421', 'hello');

    expect(result).toEqual({ leadId: '1421' });
    // Nothing for the caller to append optimistically.
    expect(Object.keys(result)).toEqual(['leadId']);
  });

  it('falls back to the requested id when the body omits it', async () => {
    mockPostForm.mockResolvedValue({});

    await expect(addLeadComment('1421', 'hello')).resolves.toEqual({
      leadId: '1421',
    });
  });

  it('propagates a 403 so the caller can disable the composer', async () => {
    const { ApiError } = jest.requireActual('../src/services/httpClient');
    mockPostForm.mockRejectedValue(new ApiError(403, 'You can only comment on leads assigned to you.'));

    await expect(addLeadComment('1421', 'hello')).rejects.toThrow(
      /assigned to you/,
    );
  });
});

describe('updateLeadStatus', () => {
  beforeEach(() => mockPostForm.mockReset());

  it('posts id, field and status as form fields', async () => {
    mockPostForm.mockResolvedValue({ status: 'success' });

    await updateLeadStatus('208', 'deal_done', '1');

    expect(mockPostForm).toHaveBeenCalledWith('leads/status', {
      id: '208',
      field: 'deal_done',
      status: '1',
    });
  });

  it('uses the lead-scoped path, not the dead properties one', async () => {
    mockPostForm.mockResolvedValue({ status: 'success' });

    await updateLeadStatus('208', 'pipeline', '3');

    expect(mockPostForm.mock.calls[0][0]).toBe('leads/status');
    expect(mockPostForm.mock.calls[0][0]).not.toContain('properties');
  });

  it('accepts both documented success shapes', async () => {
    mockPostForm.mockResolvedValue({ status: 'success' });
    await expect(updateLeadStatus('208', 'pipeline', '1')).resolves.toBe(true);

    mockPostForm.mockResolvedValue(true);
    await expect(updateLeadStatus('208', 'pipeline', '1')).resolves.toBe(true);
  });

  it('propagates a 403 rather than swallowing it', async () => {
    const { ApiError } = jest.requireActual('../src/services/httpClient');
    mockPostForm.mockRejectedValue(
      new ApiError(403, 'You can only update leads assigned to you.'),
    );

    await expect(
      updateLeadStatus('208', 'pipeline', '1'),
    ).rejects.toThrow(/assigned to you/);
  });
});
