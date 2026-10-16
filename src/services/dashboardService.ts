import { USE_MOCK } from '../config';
import { delay, pickNumber } from './utils';
import { get } from './httpClient';
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
