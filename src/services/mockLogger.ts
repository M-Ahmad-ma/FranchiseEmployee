import { USE_MOCK } from '../config';

/**
 * Trace for the mock paths.
 *
 * With `USE_MOCK` on, no HTTP request is made, so the transport logger stays
 * silent — which makes it easy to believe data came from the server when it
 * came from a fixture. Every mocked fetch announces itself here instead, and
 * prints the payload so the normaliser can be checked against real rows.
 */

/** Set to true to print every mocked call. */
export const LOG_MOCK = false;

/** Print fixture payloads as well as the call itself. */
export const LOG_MOCK_BODIES = true;

const MAX_LENGTH = 1500;

const enabled = () => LOG_MOCK && __DEV__;

/**
 * Caps a serialized payload so a long fixture does not bury the console.
 */
function shorten(text: string) {
  return text.length > MAX_LENGTH
    ? `${text.slice(0, MAX_LENGTH)}… (${text.length} bytes)`
    : text;
}

/**
 * Serializes before logging. Passing the object as a separate argument is the
 * idiomatic form, but React Native's console.log stringifies extra arguments,
 * so the payload would arrive as `[object Object]` — the one thing this logger
 * exists to avoid.
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

const stamp = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
};

/**
 * Logs a mocked endpoint. `payload` is the fixture being handed back, so a
 * wrong row shape is visible here rather than as a blank cell on screen.
 */
export function logMock(endpoint: string, payload?: unknown) {
  if (!enabled()) {
    return;
  }

  console.log(
    `[mock ${stamp()}] → ${endpoint} ${
      USE_MOCK ? '(no network call made)' : ''
    }`,
  );

  if (LOG_MOCK_BODIES && payload !== undefined) {
    console.log(
      `[mock ${stamp()}]   data: ${shorten(safeJson(payload))}`,
    );
  }
}