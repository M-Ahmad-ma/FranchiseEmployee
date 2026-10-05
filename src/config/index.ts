/**
 * Central API configuration.
 *
 * Swap USE_MOCK to false and point API_BASE_URL at the real server — every
 * service in src/services already branches on these flags.
 */

/** Server origin. The Team API is served from `${API_BASE_URL}/api/team`. */
export const API_BASE_URL = 'https://example.com';

/** Base for the employee/team API (see TEAM_API_DOCUMENTATION.md). */
export const TEAM_API_BASE = `${API_BASE_URL}/api/team`;

/** While true, services return mock fixtures instead of hitting the network. */
export const USE_MOCK = true;

/** Simulated network latency for mock fetches (ms). */
export const MOCK_DELAY_MS = 600;

/**
 * `ci_session` lifetime, per the API's `Max-Age=7200`. Used as the fallback
 * when a Set-Cookie header omits Max-Age.
 */
export const SESSION_MAX_AGE_SECONDS = 7200;