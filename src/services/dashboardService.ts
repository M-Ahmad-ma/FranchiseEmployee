import { USE_MOCK } from '../config';
import { delay, pickNumber } from './utils';
import { get, onSessionCleared } from './httpClient';
import { DASHBOARD_FIXTURE } from './mockFixtures';
import { logMock } from './mockLogger';

export interface DashboardStats {
  tasks: number;
  meetings: number;
  requests: number;
  companies: number;
  properties: number;
}

/**
 * GET /api/team/dashboard — aggregate counts scoped to the session's employee.
 * Set USE_MOCK to false to hit the real endpoint.
 */
export async function fetchDashboard(): Promise<DashboardStats> {
  if (USE_MOCK) {
    await delay();
    logMock('dashboard', DASHBOARD_FIXTURE);
    return DASHBOARD_FIXTURE;
  }

  const data = await get<{ stats?: Partial<DashboardStats> }>('dashboard');
  const stats = data?.stats;


  return {
    tasks: pickNumber(stats ?? {}, ['tasks', 'task']),
    meetings: pickNumber(stats ?? {}, ['meetings', 'meeting']),
    requests: pickNumber(stats ?? {}, ['requests', 'request']),
    companies: pickNumber(stats ?? {}, ['companies', 'company']),
    properties: pickNumber(stats ?? {}, ['properties', 'Properties', 'property']),
  };
}

/**
 * The drawer and Home ask for the same counters, often within a second of each
 * other. A short cache plus in-flight dedupe keeps those requests from queueing
 * behind one another on the CI3 session lock.
 */
export const DASHBOARD_CACHE_MS = 30_000;

let cached: { data: DashboardStats; at: number } | null = null;
let inFlight: Promise<DashboardStats> | null = null;

export function clearDashboardCache() {
  cached = null;
  inFlight = null;
}

export async function fetchDashboardCached(
  maxAgeMs = DASHBOARD_CACHE_MS,
): Promise<DashboardStats> {
  if (cached && Date.now() - cached.at < maxAgeMs) {
    return cached.data;
  }
  if (inFlight) {
    return inFlight;
  }

  inFlight = fetchDashboard()
    .then(result => {
      cached = { data: result, at: Date.now() };
      inFlight = null;
      return result;
    })
    .catch(error => {
      inFlight = null;
      throw error;
    });

  return inFlight;
}

onSessionCleared(clearDashboardCache);
