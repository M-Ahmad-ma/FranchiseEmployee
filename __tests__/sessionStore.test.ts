import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearStoredSession,
  loadSession,
  saveSession,
  saveStoredUser,
} from '../src/services/sessionStore';
import {
  clearSession,
  getSessionExpiresAt,
  hasSession,
  restoreSession,
  storeSessionCookie,
} from '../src/services/httpClient';

/**
 * The session has to survive the process being killed, which means the cookie
 * and its expiry live on disk as well as in the module-level jar.
 *
 * The three things that can silently break this:
 *  - `clearSession()` without wiping storage — sign-out looks clean but the next
 *    launch restores the dead cookie
 *  - restoring an expired entry — the user lands on a shell whose every request
 *    401s
 *  - a failing disk write taking down the request that triggered it
 */

const USER = {
  empId: 5,
  name: 'Sumeet Khan',
  email: 'employee@franchisepk.com',
  contact: '03171919170',
  position: 'Sales Manager',
  isAdminTier: false,
};

const MINUTE = 60_000;

beforeEach(async () => {
  (AsyncStorage as unknown as { __resetStore: () => void }).__resetStore();
  clearSession();
});

describe('storing on capture', () => {
  it('persists the cookie and its expiry when Set-Cookie arrives', async () => {
    storeSessionCookie('ci_session=abc123; Path=/; Max-Age=7200');

    const stored = await loadSession();
    expect(stored?.cookie).toBe('ci_session=abc123');
    expect(stored?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('ignores a Set-Cookie without a ci_session pair', () => {
    expect(storeSessionCookie('other=1; Path=/')).toBe(false);
    expect(storeSessionCookie(null)).toBe(false);
  });

  it('persists the cached profile for the drawer', async () => {
    await saveSession('ci_session=abc', Date.now() + MINUTE, USER);

    const stored = await loadSession();
    expect(stored?.user).toEqual(USER);
  });

  it('clears a stale profile when saving without one', async () => {
    await saveSession('ci_session=abc', Date.now() + MINUTE, USER);
    await saveSession('ci_session=def', Date.now() + MINUTE);

    const stored = await loadSession();
    expect(stored?.user).toBeUndefined();
  });
});

describe('clearing', () => {
  it('wipes storage as well as the in-memory jar', async () => {
    storeSessionCookie('ci_session=abc; Max-Age=7200');
    expect(hasSession()).toBe(true);

    clearSession();

    expect(hasSession()).toBe(false);
    expect(await loadSession()).toBeNull();
  });

  it('is idempotent', async () => {
    storeSessionCookie('ci_session=abc; Max-Age=7200');

    await clearStoredSession();
    await clearStoredSession();

    expect(await loadSession()).toBeNull();
  });
});

describe('restoreSession', () => {
  it('seeds the jar without a Set-Cookie header', () => {
    const expiry = Date.now() + MINUTE;
    restoreSession('ci_session=xyz', expiry);

    expect(hasSession()).toBe(true);
    expect(getSessionExpiresAt()).toBe(expiry);
  });
});

describe('loadSession', () => {
  it('returns null when nothing is stored', async () => {
    expect(await loadSession()).toBeNull();
  });

  it('discards and deletes an expired entry', async () => {
    await saveSession('ci_session=old', Date.now() - 1);

    expect(await loadSession()).toBeNull();
    // Deleted, so the same dead cookie is not re-checked on every launch.
    expect(
      (AsyncStorage as unknown as { __store: Map<string, string> }).__store.size,
    ).toBe(0);
  });

  it('discards a corrupt expiry rather than restoring it', async () => {
    const store = (
      AsyncStorage as unknown as { __store: Map<string, string> }
    ).__store;
    store.set('@franchisepk/session/cookie', 'ci_session=abc');
    store.set('@franchisepk/session/expiresAt', 'not-a-number');

    expect(await loadSession()).toBeNull();
    expect(store.size).toBe(0);
  });

  it('keeps the cookie when only the cached profile is corrupt', async () => {
    const store = (
      AsyncStorage as unknown as { __store: Map<string, string> }
    ).__store;
    store.set('@franchisepk/session/cookie', 'ci_session=abc');
    store.set('@franchisepk/session/expiresAt', String(Date.now() + MINUTE));
    store.set('@franchisepk/session/user', '{not json');

    const stored = await loadSession();
    expect(stored?.cookie).toBe('ci_session=abc');
    expect(stored?.user).toBeUndefined();
  });

  it('survives a storage read that rejects', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const spy = jest
      .spyOn(AsyncStorage, 'getMany')
      .mockRejectedValueOnce(new Error('disk full'));

    expect(await loadSession()).toBeNull();

    spy.mockRestore();
    warn.mockRestore();
  });

  it('survives a storage write that rejects, without throwing', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const spy = jest
      .spyOn(AsyncStorage, 'setMany')
      .mockRejectedValueOnce(new Error('disk full'));

    // Must not reject: the in-memory session still works until the app closes.
    await expect(
      saveSession('ci_session=abc', Date.now() + MINUTE),
    ).resolves.toBeUndefined();

    spy.mockRestore();
    warn.mockRestore();
  });

  it('survives a storage clear that rejects', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const spy = jest
      .spyOn(AsyncStorage, 'removeMany')
      .mockRejectedValueOnce(new Error('disk full'));

    await expect(clearStoredSession()).resolves.toBeUndefined();

    spy.mockRestore();
    warn.mockRestore();
  });
});

describe('saveStoredUser', () => {
  it('replaces only the profile', async () => {
    await saveSession('ci_session=abc', Date.now() + MINUTE);
    await saveStoredUser({ ...USER, name: 'Updated Name' });

    const stored = await loadSession();
    expect(stored?.user?.name).toBe('Updated Name');
    expect(stored?.cookie).toBe('ci_session=abc');
  });
});
