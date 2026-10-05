import { USE_MOCK } from '../config';
import { delay, pickString } from './utils';
import { get } from './httpClient';
import { TASKS_FIXTURE } from './mockFixtures';

export type TaskState = 'open' | 'completed';

/** `0` = open/pending, `1` = completed — the API's own convention. */
export type TaskStatusFilter = 0 | 1;

export interface TaskRow {
  id: string;
  title: string;
  state: TaskState;
  assignedTo: string;
  comment: string;
  date: string;
}

function normalizeTask(row: Record<string, unknown>): TaskRow {
  return {
    id: pickString(row, ['id', 'task_id', 'assign_id']),
    title: pickString(row, [
      'title',
      'task_title',
      'task_name',
      'task',
      'name',
    ]),
    // Anything other than 1 is treated as open, matching the API's default.
    state: pickString(row, ['status']) === '1' ? 'completed' : 'open',
    assignedTo: pickString(row, [
      'emp_name',
      'assign_name',
      'employee_name',
      'u_firstname',
    ]),
    comment: pickString(row, ['comment', 'comments', 'description']),
    date: pickString(row, [
      'date',
      'due_date',
      'u_date',
      'created',
      'created_at',
    ]),
  };
}

/**
 * GET /api/team/tasks — the employee's task list.
 *
 * This endpoint has no server-side filtering beyond `status`, and no
 * pagination, so the full set is returned either way.
 *
 * Set USE_MOCK to false to hit the real endpoint.
 */
export async function fetchTasks(
  filter: TaskStatusFilter | 'all' = 'all',
): Promise<TaskRow[]> {
  if (USE_MOCK) {
    await delay();
    return TASKS_FIXTURE.map(row =>
      normalizeTask(row as Record<string, unknown>),
    ).filter(task =>
      filter === 'all'
        ? true
        : task.state === (filter === 1 ? 'completed' : 'open'),
    );
  }

  const data = await get<{ tasks?: Record<string, unknown>[] }>('tasks', {
    status: filter === 'all' ? undefined : filter,
  });

  return (data?.tasks ?? []).map(normalizeTask);
}
