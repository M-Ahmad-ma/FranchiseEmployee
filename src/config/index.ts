/**
 * Central API configuration.
 *
 * Swap USE_MOCK to false and set API_BASE_URL once the backend is live —
 * every service in src/services already branches on these flags.
 */
export const API_BASE_URL = 'https://api.example.com'; // TODO: replace with real backend URL

/** While true, services return mock/empty data instead of hitting the network. */
export const USE_MOCK = true;

/** Simulated network latency for mock fetches (ms). */
export const MOCK_DELAY_MS = 600;
