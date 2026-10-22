import { USE_MOCK } from '../config';

/**
 * Console logging for API traffic.
 *
 * Every call goes through `httpClient`, so logging there means one place sees
 * every request — including the ones a screen fires on focus. That matters
 * here: the row-field names for `/followups` and the dropdown keys are guesses
 * until the server is watched, and this is how you confirm or correct them.
 *
 * Off by default, and forced off in release builds: these lines print response
 * bodies, which include session state and employee contact details.
 */

/**
 * Set to true to print every request and response.
 *
 * Off by default: these lines print response bodies, which include employee
 * names and phone numbers. Switch it on when a response needs reading off the
 * wire — the status, the URL and the body all land in the Metro console —
 * and switch it back off afterwards. `enabled()` also checks `__DEV__`, so a
 * release build never prints this either way.
 */
export const LOG_API = false;

/** Print payload bodies. Turn off to log only method, URL, status and timing. */
export const LOG_API_BODIES = true;

/**
 * Serializes to JSON in a single string argument.
 *
 * Passing the object as its own argument is the idiomatic thing to do, but
 * React Native's console.log stringifies extra arguments, so a logged payload
 * arrives as `[object Object]` — exactly the output we are trying to read.
 */
function emit(line: string, value?: unknown) {
  console.log(`${line} ${safeJson(value)}`);
}

/**
 * Falls back to String() for values JSON cannot represent. A string is
 * returned untouched — a response body is already JSON text, and re-encoding
 * it would print escaped quotes inside escaped quotes.
 */
function safeJson(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 0) ?? String(value);
  } catch {
    return String(value);
  }
}

/** Describes one multipart part, which is either a field or a file reference. */
function describePart(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  const file = value as {
    name?: string;
    size?: number | null;
    uri?: string;
    headers?: Record<string, string>;
  };

  // React Native puts the declared type in headers, not on `type`.
  const type = file.headers?.['Content-Type'] ?? '';
  const suffix = type ? ` (${type})` : '';

  return `file:${file.name ?? 'unknown'}${
    file.size ? ` ${Math.round(file.size / 1024)} KB` : ''
  }${suffix}`;
}

/**
 * Collapses a FormData into something readable, so an upload line shows the
 * field names and picked file names rather than nothing useful.
 *
 * Exported for tests: the two shapes below are mutually exclusive at runtime,
 * so both have to be pinned here rather than only on a device.
 *
 * React Native's polyfill has no `forEach` — it exposes `getParts()` — so that
 * is read first. The `forEach` branch covers the WHATWG FormData used by Jest,
 * which is a different implementation of the same interface.
 */
export function describeForm(form: FormData) {
  const parts: Record<string, string> = {};

  const withParts = form as unknown as { getParts?: () => unknown[] };
  if (typeof withParts.getParts === 'function') {
    for (const part of withParts.getParts() as {
      string?: string;
      uri?: string;
      name?: string;
      headers?: Record<string, string>;
    }[]) {
      // Field parts carry `string`; file parts carry a `uri`.
      const key = part.string ?? part.name ?? 'file';
      parts[key] =
        part.string ??
        describePart({
          ...part,
          size: (part as { size?: number }).size,
        });
    }
    return parts;
  }

  const iterable = form as unknown as {
    forEach?: (cb: (value: unknown, key: string) => void) => void;
  };
  iterable.forEach?.((value, key) => {
    parts[key] = describePart(value);
  });

  return parts;
}

/**
 * Caps a serialized payload so a 200-row list does not bury the console.
 * Applied after JSON so the cutoff lands on the text that is actually shown.
 */
const MAX_LENGTH = 2000;

function shorten(text: string) {
  return text.length > MAX_LENGTH
    ? `${text.slice(0, MAX_LENGTH)}… (${text.length} bytes)`
    : text;
}

const stamp = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
};

/* -------------------------------------------------------------------------- */
/*  Internals                                                                 */
/* -------------------------------------------------------------------------- */

type Body = string | FormData | undefined;

/**
 * The logger is inert unless `LOG_API` is switched on, and always off in a
 * release build — these lines print response bodies, which include session
 * state and employee contact details.
 */
const enabled = () => LOG_API && __DEV__;

/** Strips the origin so lines stay readable next to the route. */
function shortUrl(url: string) {
  return url.replace(/^https?:\/\/[^/]+/, '');
}

/**
 * Single funnel for every request, so the fetch and XHR paths log identically.
 */
function write(
  direction: '→' | '←' | '✗',
  method: string,
  url: string,
  detail?: Record<string, unknown>,
) {
  if (!enabled()) {
    return;
  }

  const tail = detail && Object.keys(detail).length ? ` ${JSON.stringify(detail)}` : '';
  console.log(`[api ${stamp()}] ${direction} ${method} ${shortUrl(url)}${tail}`);
}

/** Logs a body, honouring `LOG_API_BODIES` and the truncation limit. */
function writeBody(label: string, body: Body) {
  if (!enabled() || !LOG_API_BODIES || body === undefined) {
    return;
  }

  // A multipart body is summarised field-by-field; a string body is printed
  // as-is so form-encoded pairs stay readable.
  const value =
    typeof FormData !== 'undefined' && body instanceof FormData
      ? describeForm(body)
      : body;

  emit(`[api ${stamp()}]   ${label}`, shorten(safeJson(value)));
}

/**
 * Starts a timed request and returns its finish handlers. The timing is what
 * makes a slow endpoint obvious — the follow-ups bell polls every 60s, so
 * without it a normal poll is indistinguishable from a hang.
 */
export function beginRequest(method: string, url: string, body?: Body) {
  if (!enabled()) {
    return { finish: () => {}, fail: () => {} };
  }

  const startedAt = Date.now();
  write('→', method, url, { mock: USE_MOCK });
  writeBody('request:', body);

  const elapsed = () => `${Date.now() - startedAt}ms`;

  return {
    finish: (status: number, responseBody?: string | null) => {
      write('←', method, url, { status, in: elapsed() });
      writeBody('response:', responseBody ?? undefined);
    },
    fail: (status: number | 0, message: string) => {
      write('✗', method, url, { status, in: elapsed(), error: message });
    },
  };
}