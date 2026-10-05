import { SESSION_MAX_AGE_SECONDS, TEAM_API_BASE } from '../config';

/**
 * Transport for the Team API.
 *
 * The API is session-based rather than token-based: login emits a
 * `ci_session` cookie (HttpOnly, Max-Age=7200) and every later request must
 * replay it. React Native's fetch does not reliably persist or re-send
 * cookies, so we keep our own jar and also ask the platform to via
 * `credentials: 'include'` — whichever works on the current platform wins.
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface Envelope<T> {
  status: boolean;
  message: string;
  data: T;
}

type UnauthorizedHandler = () => void;

/* -------------------------------------------------------------------------- */
/*  Session cookie                                                             */
/* -------------------------------------------------------------------------- */

let sessionCookie: string | null = null;
let sessionExpiresAt = 0;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export const hasSession = () => sessionCookie !== null;

/** Epoch ms at which the current session lapses — 0 when signed out. */
export const getSessionExpiresAt = () => sessionExpiresAt;

export function clearSession() {
  sessionCookie = null;
  sessionExpiresAt = 0;
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

/** Pulls just the `ci_session` pair out of a Set-Cookie header. */
function readSessionCookie(setCookie: string) {
  const match = setCookie.match(/(?:^|,\s*)ci_session=([^;,\s]+)/);
  return match ? `ci_session=${match[1]}` : null;
}

export function storeSessionCookie(setCookie: string | null): boolean {
  if (!setCookie) {
    return false;
  }
  const cookie = readSessionCookie(setCookie);
  if (!cookie) {
    return false;
  }
  const maxAge = Number(setCookie.match(/Max-Age=(\d+)/i)?.[1]);
  sessionCookie = cookie;
  sessionExpiresAt =
    Date.now() +
    (Number.isFinite(maxAge) && maxAge > 0 ? maxAge : SESSION_MAX_AGE_SECONDS) *
      1000;
  return true;
}

function fireUnauthorized() {
  clearSession();
  unauthorizedHandler?.();
}

/* -------------------------------------------------------------------------- */
/*  Request                                                                    */
/* -------------------------------------------------------------------------- */

export type QueryValue = string | number | undefined | null;

interface RequestOptions {
  method?: 'GET' | 'POST';
  query?: Record<string, QueryValue>;
  json?: unknown;
}

const EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';

function buildUrl(path: string, query?: RequestOptions['query']) {
  const search = Object.entries(query ?? {})
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    )
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join('&');
  return `${TEAM_API_BASE}/${path.replace(/^\//, '')}${search ? `?${search}` : ''}`;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', query, json } = options;

  // Catch the 2-hour expiry locally so the user isn't left waiting on a 401.
  if (sessionCookie && Date.now() > sessionExpiresAt) {
    fireUnauthorized();
    throw new ApiError(401, EXPIRED_MESSAGE);
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (sessionCookie) {
    headers.Cookie = sessionCookie;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      credentials: 'include',
      ...(json === undefined ? null : { body: JSON.stringify(json) }),
    });
  } catch {
    throw new ApiError(0, 'Network unavailable. Check your connection.');
  }

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    storeSessionCookie(setCookie);
  }

  const payload = (await response
    .json()
    .catch(() => null)) as Envelope<T> | null;

  if (response.status === 401) {
    fireUnauthorized();
    throw new ApiError(401, payload?.message || EXPIRED_MESSAGE);
  }

  if (!response.ok || !payload || payload.status !== true) {
    throw new ApiError(
      response.status,
      payload?.message || 'Something went wrong. Please try again.',
    );
  }

  return payload.data;
}

export const get = <T>(path: string, query?: RequestOptions['query']) =>
  request<T>(path, { query });

export const postJson = <T>(path: string, json?: unknown) =>
  request<T>(path, { method: 'POST', json });
