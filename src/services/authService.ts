import { USE_MOCK } from '../config';
import { delay, pickNumber, pickString } from './utils';
import {
  ApiError,
  clearSession,
  get,
  hasSession,
  postJson,
} from './httpClient';
import { EMPLOYEE_FIXTURE, EMPLOYEE_PERMISSIONS_FIXTURE } from './mockFixtures';
import { logMock } from './mockLogger';

/**
 * Authenticated employee, normalised from `data.employee` or `/auth/me`.
 *
 * `permissionKeys` is `null` only when the server did not send permission data
 * at all. Once the field is present every screen gates against it. See
 * `services/permissions.ts` for why `null` and `[]` are deliberately different.
 */
export interface AuthUser {
  empId: number;
  name: string;
  image: string;
  email: string;
  contact: string;
  position: string;
  permissionKeys: string[] | null;
  roles: string[];
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Reads a string array from either a real array or a JSON-encoded one.
 * Anything unrecognised is treated as "not supplied" (`null`), not as "none".
 */
function readStringList(value: unknown): string[] | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'string') {
    try {
      return readStringList(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .map(item => String(item).trim())
    .filter((item): item is string => item.length > 0);
}

function normalizeEmployee(row: Record<string, unknown>): Omit<
  AuthUser,
  'permissionKeys' | 'roles'
> {
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
    image: pickString(row, ['image']),
    position: pickString(row, ['position', 'a_position'], 'Franchise Employee'),
  };
}

/**
 * Normalises both documented auth shapes:
 *
 *   login:  { employee: {...}, permission_keys: [...], roles: [...] }
 *   /me:    { emp_id, u_firstname, ..., permission_keys: [...], roles: [...] }
 *
 * Some deployments may nest the permission fields inside `employee`; that is
 * accepted too. `permissions` (the legacy `{ company: "1" }` object) is
 * deliberately ignored.
 */
export function normalizeAuthPayload(
  data: Record<string, unknown>,
): AuthUser {
  const employee = isRecord(data.employee) ? data.employee : data;

  const permissionKeys =
    readStringList(data.permission_keys) ??
    readStringList(employee.permission_keys);
  const roles =
    readStringList(data.roles) ?? readStringList(employee.roles) ?? [];

  return {
    ...normalizeEmployee(employee),
    permissionKeys,
    roles,
  };
}

/**
 * Preserves permission data when a fresh `/auth/me` omits it.
 *
 * This matters on login: the login response is the only documented source of
 * `permission_keys` in some deployments, and an `/auth/me` that returns just
 * the profile must not wipe the keys that login already supplied.
 */
export function mergeAuthUser(
  previous: AuthUser | null,
  next: AuthUser,
): AuthUser {
  return {
    ...next,
    permissionKeys: next.permissionKeys ?? previous?.permissionKeys ?? null,
    roles: next.roles.length > 0 ? next.roles : (previous?.roles ?? []),
  };
}

/**
 * Sign in with email + password.
 *
 * POST /api/team/auth/login is one of the few endpoints whose controller merges
 * a JSON body, and the response is what sets the `ci_session` cookie.
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
    const employee = normalizeAuthPayload({
      employee: EMPLOYEE_FIXTURE,
      permission_keys: EMPLOYEE_PERMISSIONS_FIXTURE,
      roles: ['Employee (Basic)'],
    });
    // The password is deliberately left out of the log.
    logMock('auth/login', employee);
    return employee;
  }

  const data = await postJson<Record<string, unknown>>('auth/login', {
    email: email.trim(),
    password,
  });


  console.log("login", data)

  if (!isRecord(data) || !isRecord(data.employee)) {
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

  return normalizeAuthPayload(data);
}

/**
 * GET /api/team/auth/me — the signed-in employee's profile and permissions.
 *
 * The response may be a flat employee row or a wrapper with an `employee` key;
 * `normalizeAuthPayload` reads both. Permissions may be absent on an older
 * deployment, in which case `AuthContext` keeps the keys from login.
 */
export async function fetchProfile(): Promise<AuthUser> {
  if (USE_MOCK) {
    await delay();
    const employee = normalizeAuthPayload({
      employee: EMPLOYEE_FIXTURE,
      permission_keys: EMPLOYEE_PERMISSIONS_FIXTURE,
      roles: ['Employee (Basic)'],
    });
    logMock('auth/me', employee);
    return employee;
  }

  const data = await get<Record<string, unknown>>('auth/me');

  if (!isRecord(data)) {
    throw new ApiError(0, 'Profile response was malformed.');
  }

  return normalizeAuthPayload(data);
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
    logMock('auth/logout');
  }
  clearSession();
}
