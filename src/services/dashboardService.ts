import { USE_MOCK } from '../config';
import { delay, pickNumber } from './utils';
import { get } from './httpClient';
import { DASHBOARD_FIXTURE } from './mockFixtures';

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
    return DASHBOARD_FIXTURE;
  }

  const data = await get<{ stats?: Partial<DashboardStats> }>('dashboard');
  const stats = data?.stats;

  return {
    tasks: pickNumber(stats ?? {}, ['tasks']),
    meetings: pickNumber(stats ?? {}, ['meetings']),
    requests: pickNumber(stats ?? {}, ['requests']),
    companies: pickNumber(stats ?? {}, ['companies']),
    properties: pickNumber(stats ?? {}, ['properties']),
  };
}
