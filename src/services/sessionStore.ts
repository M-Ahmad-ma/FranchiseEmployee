import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persistence for the `ci_session` cookie so the app survives being closed and
 * reopened.
 *
 * React Native does not persist or reliably replay cookies the way the Kotlin
 * interceptor in the integration guide relies on, which is why `httpClient`
 * keeps its own in-memory jar. That jar dies with the process, so this module
 * writes the same three values to disk and `httpClient` rehydrates from them on
 * boot.
 *
 * **This is unencrypted storage.** On Android it is a plain SQLite file and on
 * iOS an unencrypted plist, so a rooted device or a backup could read the
 * cookie. That is an acceptable trade for a session token the server expires
 * after two hours; it would not be acceptable for anything longer-lived.
 *
 * The employee profile is stored alongside purely so the drawer can paint
 * before the verification round trip finishes. It is never trusted on its own —
 * see `restoreSession`.
 */

const COOKIE_KEY = '@franchisepk/session/cookie';
const EXPIRES_KEY = '@franchisepk/session/expiresAt';
const USER_KEY = '@franchisepk/session/user';

/**
 * Structural copy of `AuthUser`.
 *
 * Declared here rather than imported so this module does not depend on
 * `authService`, which already depends on `httpClient` — importing the type
 * would close a cycle through the store.
 */
export interface PersistedUser {
  empId: number;
  name: string;
  email: string;
  contact: string;
  position: string;
  isAdminTier: boolean;
}

export interface StoredSession {
  /** Full `ci_session=<value>` pair, ready to send as a Cookie header. */
  cookie: string;
  /** Epoch ms at which the server lapses this session. */
  expiresAt: number;
  user?: PersistedUser;
}

export async function saveSession(
  cookie: string,
  expiresAt: number,
  user?: PersistedUser,
): Promise<void> {
  try {
    await AsyncStorage.setMany({
      [COOKIE_KEY]: cookie,
      [EXPIRES_KEY]: String(expiresAt),
      // Written even when user is undefined, so a re-login that returns no
      // profile cannot leave the previous employee's name on screen.
      [USER_KEY]: user ? JSON.stringify(user) : '',
    });
  } catch (error) {
    // Persistence is a convenience, not a correctness requirement. If the disk
    // write fails the in-memory session still works until the app is closed, so
    // this must not take down the request that triggered it.
    console.warn('[session] could not persist the session', error);
  }
}

/** Replaces just the cached profile, after a fresh `/auth/me`. */
export async function saveStoredUser(user: PersistedUser): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.warn('[session] could not persist the profile', error);
  }
}

/**
 * Reads the stored session, or `null` when there is nothing usable.
 *
 * An expired entry is reported as `null` *and* deleted here rather than left for
 * the caller to reason about — there is no correct use for it.
 */
export async function loadSession(): Promise<StoredSession | null> {
  try {
    const stored = await AsyncStorage.getMany([
      COOKIE_KEY,
      EXPIRES_KEY,
      USER_KEY,
    ]);

    const cookie = stored[COOKIE_KEY];
    const rawExpiry = stored[EXPIRES_KEY];
    if (!cookie || !rawExpiry) {
      return null;
    }

    const expiresAt = Number(rawExpiry);
    if (!Number.isFinite(expiresAt)) {
      await clearStoredSession();
      return null;
    }

    if (Date.now() >= expiresAt) {
      // The server lapsed it while the app was closed. Deleting now avoids
      // re-checking the same dead cookie on every launch.
      await clearStoredSession();
      return null;
    }

    const rawUser = stored[USER_KEY];
    let user: PersistedUser | undefined;
    if (rawUser) {
      try {
        user = JSON.parse(rawUser) as PersistedUser;
      } catch {
        // A corrupt profile is not worth failing the whole restore over — the
        // cookie is what authenticates, and the profile is re-fetched anyway.
        user = undefined;
      }
    }

    return { cookie, expiresAt, user };
  } catch (error) {
    console.warn('[session] could not read the stored session', error);
    return null;
  }
}

/**
 * Removes every trace of the session.
 *
 * Called on sign-out and on any 401. If this is skipped, the next launch
 * restores a cookie the server has already rejected.
 */
export async function clearStoredSession(): Promise<void> {
  try {
    await AsyncStorage.removeMany([COOKIE_KEY, EXPIRES_KEY, USER_KEY]);
  } catch (error) {
    console.warn('[session] could not clear the stored session', error);
  }
}
