import { USE_MOCK } from '../config';
import { delay, pickNumber, pickString } from './utils';
import {
  ApiError,
  clearSession,
  get,
  hasSession,
  postJson,
} from './httpClient';
import { EMPLOYEE_FIXTURE } from './mockFixtures';

/** Authenticated employee, normalised from `data.employee`. */
export interface AuthUser {
  empId: number;
  name: string;
  email: string;
  contact: string;
  position: string;
  /** `emp_special === "1"` — admin-tier access. */
  isAdminTier: boolean;
}

export interface Credentials {
  email: string;
  password: string;
}

/**
 * Client-side floor used only to shape the login form. The server does its own
 * validation and is the source of truth.
 */
export const MIN_PASSWORD_LENGTH = 6;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (email: string) => EMAIL_PATTERN.test(email.trim());

function normalizeEmployee(row: Record<string, unknown>): AuthUser {
  const first = pickString(row, ['firstname', 'u_firstname']);
  const last = pickString(row, ['lastname', 'u_lastname']);

  return {
    empId: pickNumber(row, ['emp_id', 'u_id']),
    name:
      pickString(row, ['name']) ||
      `${first} ${last}`.trim() ||
      'Franchise Employee',
    email: pickString(row, ['email', 'u_email']),
    contact: pickString(row, ['contact', 'u_contact']),
    position: pickString(row, ['position', 'a_position'], 'Franchise Employee'),
    isAdminTier: pickString(row, ['emp_special']) === '1',
  };
}

/**
 * Sign in with email + password.
 *
 * POST /api/team/auth/login is one of the few endpoints whose controller merges
 * a JSON body, and the response is what sets the `ci_session` cookie. Set
 * USE_MOCK to false to hit the real endpoint.
 */
export async function signIn({
  email,
  password,
}: Credentials): Promise<AuthUser> {
  if (USE_MOCK) {
    await delay();
    if (!isValidEmail(email) || password.length < MIN_PASSWORD_LENGTH) {
      throw new Error('Incorrect email or password.');
    }
    return normalizeEmployee(EMPLOYEE_FIXTURE);
  }

  const data = await postJson<{ employee?: Record<string, unknown> }>(
    'auth/login',
    { email: email.trim(), password },
  );

  if (!data?.employee) {
    throw new ApiError(0, 'Login response was malformed. Please try again.');
  }

  if (!hasSession()) {
    // The API sets `ci_session` on login. iOS does not always surface
    // Set-Cookie through fetch headers, so warn rather than fail silently.
    console.warn(
      '[auth] Login succeeded but no ci_session cookie was captured — ' +
        'subsequent requests may 401 until you sign in again.',
    );
  }

  return normalizeEmployee(data.employee);
}

/**
 * GET /api/team/auth/me — the signed-in employee's profile.
 *
 * Unlike `auth/login`, this returns a flat row (`u_firstname`, `a_position`)
 * rather than a nested `employee` object, but `normalizeEmployee` reads both
 * shapes. Callers use it to keep the drawer profile authoritative instead of
 * trusting whatever login happened to return.
 */
export async function fetchProfile(): Promise<AuthUser> {
  if (USE_MOCK) {
    await delay();
    return normalizeEmployee(EMPLOYEE_FIXTURE);
  }

  const data = await get<Record<string, unknown>>('auth/me');

  if (!data || typeof data !== 'object') {
    throw new ApiError(0, 'Profile response was malformed.');
  }

  return normalizeEmployee(data);
}

/**
 * Destroy the employee session. The local cookie is cleared even when the
 * request fails, so a user is never stranded in a half-signed-in state.
 */
export async function signOut(): Promise<void> {
  if (!USE_MOCK && hasSession()) {
    try {
      await postJson<boolean>('auth/logout');
    } finally {
      clearSession();
    }
    return;
  }

  if (USE_MOCK) {
    await delay();
  }
  clearSession();
}
