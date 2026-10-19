import { SESSION_MAX_AGE_SECONDS, TEAM_API_BASE } from '../config';
import { beginRequest } from './apiLogger';

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

function safeParse<T>(raw: string | null): Envelope<T> | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as Envelope<T>;
  } catch {
    return null;
  }
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