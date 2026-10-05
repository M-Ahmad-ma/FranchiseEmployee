import { USE_MOCK } from '../config';
import { contains, delay, equals, pickString, toTimestamp } from './utils';
import { get } from './httpClient';
import { REQUESTS_FIXTURE } from './mockFixtures';

export interface LeadRequestFilters {
  city?: string;
  brand?: string;
  investor?: string;
  comments?: string;
  dealsDone?: string;
  meetingType?: string;
  pipelineStatus?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface LeadRequestRow {
  id: string;
  investor: string;
  phone: string;
  city: string;
  brand: string;
  meetingType: string;
  pipelineStatus: string;
  dealsDone: string;
  date: string;
  comments: string;
}

function normalizeRow(row: Record<string, unknown>): LeadRequestRow {
  const first = pickString(row, ['u_firstname', 'firstname', 'first_name']);
  const last = pickString(row, ['u_lastname', 'lastname', 'last_name']);

  return {
    id: pickString(row, ['id', 'request_id', 'lead_id']),
    investor:
      pickString(row, ['investor', 'u_name']) || `${first} ${last}`.trim(),
    phone: pickString(row, ['u_contact', 'phone', 'contact', 'mobile']),
    city: pickString(row, ['city', 'city_name']),
    brand: pickString(row, ['brand', 'brand_name']),
    meetingType: pickString(row, ['meeting_type', 'meetingType']),
    pipelineStatus: pickString(row, ['pipeline_status', 'status_name']),
    dealsDone: pickString(row, ['deals_done', 'dealsDone']),
    date: pickString(row, ['date', 'u_date', 'created_at']),
    comments: pickString(row, ['comments', 'comment', 'description']),
  };
}

/**
 * GET /api/team/requests — leads assigned to the logged-in employee.
 *
 * This endpoint accepts no filter parameters and has no pagination, so the
 * screen's filters run client-side against the whole set.
 *
 * Set USE_MOCK to false to hit the real endpoint.
 */
export async function fetchRequests(): Promise<LeadRequestRow[]> {
  if (USE_MOCK) {
    await delay();
    return REQUESTS_FIXTURE.map(row =>
      normalizeRow(row as Record<string, unknown>),
    );
  }

  const data = await get<{ requests?: Record<string, unknown>[] }>('requests');

  return (data?.requests ?? []).map(normalizeRow);
}

/**
 * Applies the screen's filters in memory. Unset filters are ignored, and a date
 * filter is skipped when either side can't be parsed — so an unreadable date
 * format narrows nothing rather than emptying the table.
 */
export function applyRequestFilters(
  rows: LeadRequestRow[],
  filters: LeadRequestFilters,
): LeadRequestRow[] {
  const from = filters.dateFrom ? toTimestamp(filters.dateFrom) : null;
  const to = filters.dateTo ? toTimestamp(filters.dateTo) : null;

  return rows.filter(row => {
    if (!equals(row.city, filters.city)) return false;
    if (!equals(row.brand, filters.brand)) return false;
    if (!equals(row.meetingType, filters.meetingType)) return false;
    if (!equals(row.pipelineStatus, filters.pipelineStatus)) return false;
    if (!equals(row.dealsDone, filters.dealsDone)) return false;

    // The field is labelled "Investor" but searches names and numbers.
    if (
      filters.investor?.trim() &&
      !contains(row.investor, filters.investor) &&
      !contains(row.phone, filters.investor)
    ) {
      return false;
    }

    if (!contains(row.comments, filters.comments)) return false;

    if (from !== null || to !== null) {
      const stamp = toTimestamp(row.date);
      if (stamp !== null) {
        if (from !== null && stamp < from) return false;
        if (to !== null && stamp > to) return false;
      }
    }

    return true;
  });
}
