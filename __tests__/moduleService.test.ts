import { get } from '../src/services/httpClient';
import {
  clearModuleListCache,
  fetchUsers,
} from '../src/services/moduleService';

jest.mock('../src/services/httpClient', () => ({
  get: jest.fn(),
  postForm: jest.fn(),
  onSessionCleared: jest.fn(),
}));

const getMock = get as jest.MockedFunction<typeof get>;

/**
 * `ModuleRow.values` is a getter backed by a mutable key map. This pins the
 * prefill path: a User row stores `u_firstname`, while the edit form expects
 * `fname`. Replacing that map instead of mutating it left every field blank.
 */
describe('user edit prefill', () => {
  beforeEach(() => {
    clearModuleListCache();
    getMock.mockReset();
  });

  it('maps u_* fields onto the form field names', async () => {
    getMock.mockResolvedValueOnce({
      users: [
        {
          u_id: '7',
          u_firstname: 'Haseeb',
          u_lastname: 'Raja',
          u_email: 'jalips.rwp@gmail.com',
          u_contact: '03168021991',
          u_company: 'Jalips',
          u_bio: 'A long company bio',
          status: '0',
        },
      ],
    });

    const [row] = await fetchUsers(true);

    expect(row.values.fname).toBe('Haseeb');
    expect(row.values.lname).toBe('Raja');
    expect(row.values.User_email).toBe('jalips.rwp@gmail.com');
    expect(row.values.contact).toBe('03168021991');
    expect(row.values.company).toBe('Jalips');
    expect(row.values.bio).toBe('A long company bio');
  });
});
