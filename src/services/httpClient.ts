import { SESSION_MAX_AGE_SECONDS, TEAM_API_BASE } from '../config';
import { beginRequest } from './apiLogger';
import { clearStoredSession, saveSession } from './sessionStore';

/**
 * Transport for the Team API.
 *
 * The API is session-based rather than token-based: login emits a
 * `ci_session` cookie (HttpOnly, Max-Age=7200) and every later request must
 * replay it. React Native's fetch does not reliably persist or re-send
 * cookies, so we keep our own jar and also ask the platform to via
 * `credentials: 'include'` — whichever works on the current platform wins.
 *
 * Three body styles are supported, because the API needs all three:
 * `json` for the few handlers that merge a JSON body, `form` for the many that
 * read `$_POST`, and `multipart` for the two that read `$_FILES`.
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * The server's own message, with the HTTP status appended when the server
 * did not send one.
 *
 * The Team API's failure envelopes do not always carry a `message`, and
 * `unwrap` falls back to a generic "Something went wrong" string when one is
 * missing. That text carries no information, and the status is usually the
 * whole answer: 400 means the request was malformed, 403 that the record is
 * not this employee's, 404 that it is gone, 500 that the server broke.
 */
export function describeApiError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const message = error.message.trim();
    if (!message || message.includes('Something went wrong')) {
      return `${fallback} (HTTP ${error.status})`;
    }
    return message;
  }
  return fallback;
}

interface Envelope<T> {
  status: boolean;
  message: string;
  data: T;
  /** Top-level pagination block, present only on `/leads/filter`. */
  meta?: Partial<PageMeta>;
}

/** Pagination block emitted by `MY_Controller::response_paginate()`. */
export interface PageMeta {
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

/** `data` plus the pagination block, for endpoints that page server-side. */
export interface Paged<T> {
  data: T;
  meta: PageMeta;
}

type UnauthorizedHandler = () => void;

/* -------------------------------------------------------------------------- */
/*  Session cookie                                                             */
/* -------------------------------------------------------------------------- */

let sessionCookie: string | null = null;
let sessionExpiresAt = 0;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export const hasSession = () => sessionCookie !== null;

/**
 * The current cookie as a header value, or `{}` when signed out.
 *
 * `fetch` gets this automatically via the replayed `Cookie` header, but
 * `<Image source>` and `react-native-video` issue their own requests and do not
 * — so a media file behind the session would 401 without this. Only works if
 * the server actually requires auth for the file; harmless when it does not.
 */
export function getSessionHeaders(): Record<string, string> {
  return sessionCookie ? { Cookie: sessionCookie } : {};
}

/** Epoch ms at which the current session lapses — 0 when signed out. */
export const getSessionExpiresAt = () => sessionExpiresAt;

export function clearSession() {
  sessionCookie = null;
  sessionExpiresAt = 0;
  // The disk copy has to go too. Skipping this is how a sign-out looks clean
  // but the next launch still restores the dead cookie.
  void clearStoredSession();
  // Anything cached per-employee must go, or the next sign-in can read the
  // previous employee's rows before its first response lands.
  sessionClearedHandlers.forEach(handler => handler());
}

type SessionClearedHandler = () => void;
const sessionClearedHandlers: SessionClearedHandler[] = [];

/** Registers a callback fired whenever the session is torn down or expires. */
export function onSessionCleared(handler: SessionClearedHandler): () => void {
  sessionClearedHandlers.push(handler);
  return () => {
    const index = sessionClearedHandlers.indexOf(handler);
    if (index >= 0) {
      sessionClearedHandlers.splice(index, 1);
    }
  };
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
  // Persist here rather than in the login call so a refreshed Set-Cookie also
  // extends the stored session — that is what the server's Max-Age is for.
  void saveSession(cookie, sessionExpiresAt);
  return true;
}

/**
 * Rehydrates the in-memory jar from disk on launch.
 *
 * Separate from `storeSessionCookie` because the stored value is already a
 * `ci_session=<value>` pair — there is no Set-Cookie header to parse.
 *
 * The caller is responsible for checking expiry and then *verifying* the
 * cookie against the server. A stored value can be stale: the session may have
 * been revoked, or the device clock may have drifted. Seeding the jar is what
 * lets that verification request carry a cookie at all.
 */
export function restoreSession(cookie: string, expiresAt: number): void {
  sessionCookie = cookie;
  sessionExpiresAt = expiresAt;
}

function fireUnauthorized() {
  clearSession();
  unauthorizedHandler?.();
}

/* -------------------------------------------------------------------------- */
/*  Request                                                                    */
/* -------------------------------------------------------------------------- */

export type QueryValue = string | number | undefined | null;

type FormValue = string | number | boolean | undefined | null;

interface RequestOptions {
  method?: 'GET' | 'POST';
  query?: Record<string, QueryValue>;
  json?: unknown;
  /**
   * `application/x-www-form-urlencoded` body. Most write endpoints pass
   * straight through to a model that reads `$this->input->post()`; a JSON body
   * reaches those models empty, so the write silently no-ops.
   */
  form?: Record<string, FormValue>;
}

const EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';

/** Server cap on `per_page` for `/leads/filter`; anything larger is clamped. */
export const MAX_PER_PAGE = 200;

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

/** Form fields that are blank are dropped, matching how the server reads them. */
function encodeForm(form: RequestOptions['form']) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(form ?? {})) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    params.append(key, String(value));
  }
  return params.toString();
}

/**
 * Resolves the request body and its content type. A caller passing `json` gets
 * JSON; `form` gets urlencoded; passing neither sends no body at all.
 */
function buildBody(options: RequestOptions): {
  body: string | undefined;
  contentType?: string;
} {
  if (options.json !== undefined) {
    return { body: JSON.stringify(options.json), contentType: 'application/json' };
  }
  if (options.form !== undefined) {
    return {
      body: encodeForm(options.form),
      contentType: 'application/x-www-form-urlencoded',
    };
  }
  return { body: undefined };
}

function baseHeaders(contentType?: string) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  if (sessionCookie) {
    headers.Cookie = sessionCookie;
  }
  return headers;
}

/** Envelope checks shared by the fetch and XHR paths. */
function unwrap<T>(status: number, raw: string | null): Envelope<T> {
  const payload = safeParse<T>(raw);

  if (status === 401) {
    fireUnauthorized();
    throw new ApiError(401, payload?.message || EXPIRED_MESSAGE);
  }

  if (status < 200 || status >= 300 || !payload || payload.status !== true) {
    throw new ApiError(
      status,
      payload?.message || 'Something went wrong. Please try again.',
    );
  }

  return payload;
}

/**
 * Scans a body for every complete top-level JSON object in it.
 *
 * `POST /leads/status` answers with two documents in one body —
 * `{"success":true}` followed by the real envelope — so `JSON.parse` of the
 * whole body throws and the response reads as empty. The brace count is
 * string-aware, so a brace inside a value does not throw the count off.
 */
function jsonObjectsIn(raw: string): unknown[] {
  const found: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        try {
          found.push(JSON.parse(raw.slice(start, index + 1)));
        } catch {
          // Not a JSON object after all — keep scanning.
        }
        start = -1;
      } else if (depth < 0) {
        depth = 0;
      }
    }
  }

  return found;
}

/**
 * Reads the envelope out of a response body.
 *
 * The normal case is a single JSON document and `JSON.parse` handles it. It
 * fails on a body that holds more than one document, which is what
 * `POST /leads/status` returns: `{"success":true}` and then the real
 * envelope, with no separator between them. When that happens the body is
 * scanned and the **last** object that looks like an envelope is used — the
 * trailing one is the response, and anything the server printed before it is
 * not.
 */
function safeParse<T>(raw: string | null): Envelope<T> | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Envelope<T>;
  } catch {
    // Not a single document — fall through to the multi-document scan.
  }

  const objects = jsonObjectsIn(raw);
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const candidate = objects[index];
    if (candidate && typeof candidate === 'object' && 'status' in candidate) {
      return candidate as Envelope<T>;
    }
  }

  return null;
}

function assertLiveSession() {
  // Catch the 2-hour expiry locally so the user isn't left waiting on a 401.
  if (sessionCookie && Date.now() > sessionExpiresAt) {
    fireUnauthorized();
    throw new ApiError(401, EXPIRED_MESSAGE);
  }
}

/**
 * Runs a request and returns the whole envelope. Pagination responses carry a
 * top-level `meta` block that `request()` would otherwise discard.
 */
export async function requestEnvelope<T>(
  path: string,
  options: RequestOptions = {},
): Promise<Envelope<T>> {
  const { method = 'GET', query } = options;
  assertLiveSession();

  const { body, contentType } = buildBody(options);
  const url = buildUrl(path, query);
  const log = beginRequest(method, url, body);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: baseHeaders(contentType),
      credentials: 'include',
      ...(body === undefined ? null : { body }),
    });
  } catch {
    log.fail(0, 'Network unavailable');
    throw new ApiError(0, 'Network unavailable. Check your connection.');
  }

  storeSessionCookie(response.headers.get('set-cookie'));

  const raw = await response.text().catch(() => null);
  log.finish(response.status, raw);

  try {
    return unwrap<T>(response.status, raw);
  } catch (error) {
    // An error envelope is worth distinguishing from a transport failure.
    log.fail(response.status, error instanceof Error ? error.message : 'Unknown');
    throw error;
  }
}

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Fills in the fields the server omits so callers never branch on undefined. */
export function normalizeMeta(
  meta: Partial<PageMeta> | undefined,
  fallback: Partial<PageMeta> = {},
): PageMeta {
  const total = Math.max(0, toNumber(meta?.total, fallback.total ?? 0));
  const page = Math.max(1, toNumber(meta?.page, fallback.page ?? 1));
  const perPage = Math.max(1, toNumber(meta?.per_page, fallback.per_page ?? 20));

  return {
    total,
    page,
    per_page: perPage,
    pages: Math.max(1, toNumber(meta?.pages, fallback.pages ?? 1)),
  };
}

/* -------------------------------------------------------------------------- */
/*  Public verbs                                                               */
/* -------------------------------------------------------------------------- */

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return (await requestEnvelope<T>(path, options)).data;
}

export const get = <T>(path: string, query?: RequestOptions['query']) =>
  request<T>(path, { query });

export const postJson = <T>(path: string, json?: unknown) =>
  request<T>(path, { method: 'POST', json });

/** Form-encoded POST — the correct verb for every `$_POST`-driven endpoint. */
export const postForm = <T>(path: string, form: Record<string, FormValue>) =>
  request<T>(path, { method: 'POST', form });

/** GET with the pagination block preserved, for `/leads/filter`. */
export async function getPaged<T>(
  path: string,
  query?: RequestOptions['query'],
): Promise<Paged<T>> {
  const envelope = await requestEnvelope<T>(path, { query });
  return {
    data: envelope.data,
    meta: normalizeMeta(envelope.meta, {
      page: Number(query?.page) || 1,
      per_page: Math.min(Number(query?.per_page) || 20, MAX_PER_PAGE),
    }),
  };
}

/* -------------------------------------------------------------------------- */
/*  Multipart upload                                                           */
/* -------------------------------------------------------------------------- */

/**
 * POSTs `multipart/form-data` and reports progress.
 *
 * `fetch` gives no upload-progress events in React Native, so this path uses
 * XHR. The `Content-Type` header is deliberately left unset — the platform
 * appends the multipart boundary itself, and setting it by hand produces a
 * body the server cannot parse.
 */
export function uploadMultipart<T>(
  path: string,
  form: FormData,
  onProgress?: (fraction: number) => void,
): Promise<T> {
  assertLiveSession();

  const url = buildUrl(path);
  const log = beginRequest('POST', url, form);

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;

    const headers = baseHeaders();
    delete headers['Content-Type'];
    Object.entries(headers).forEach(([key, value]) =>
      xhr.setRequestHeader(key, value),
    );

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = event => {
        if (event.lengthComputable && event.total > 0) {
          onProgress(Math.min(1, event.loaded / event.total));
        }
      };
    }

    xhr.onload = () => {
      storeSessionCookie(xhr.getResponseHeader('set-cookie'));
      log.finish(xhr.status, xhr.responseText);
      try {
        resolve(unwrap<T>(xhr.status, xhr.responseText).data);
      } catch (error) {
        log.fail(
          xhr.status,
          error instanceof Error ? error.message : 'Unknown',
        );
        reject(error);
      }
    };

    xhr.onerror = () => {
      log.fail(0, 'Network unavailable');
      reject(new ApiError(0, 'Network unavailable. Check your connection.'));
    };
    xhr.ontimeout = () => {
      log.fail(0, 'Upload timed out');
      reject(new ApiError(0, 'Upload timed out. Please try again.'));
    };

    xhr.send(form);
  });
}