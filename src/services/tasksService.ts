import { USE_MOCK } from '../config';
import { get, postForm } from './httpClient';
import { delay, pickString } from './utils';
import { buildRow, type ModuleRow } from './moduleService';

/**
 * Tasks are the one module where "edit" is not a record update: the API only
 * exposes comments and assignment status, and both are `$_POST`-driven.
 */

const TASK_SPEC = {
  idKeys: ['id', 'task_id', 't_id'],
  titleKeys: ['title', 'task_title', 'name'],
  subtitleKeys: ['status', 'task_status'],
};

export async function fetchTasks(status = '0'): Promise<ModuleRow[]> {
  if (USE_MOCK) {
    await delay();
    return [];
  }
  const data = await get<{ tasks?: Record<string, unknown>[] }>('tasks', {
    status,
  });
  return (data?.tasks ?? [])
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map(row => buildRow(row, TASK_SPEC));
}

export interface TaskComment {
  id: string;
  comment: string;
  created: string;
}

export interface TaskAssignee {
  assignId: string;
  empId: string;
  empName: string;
}

export interface TaskDetail {
  task: Record<string, unknown>;
  assign: TaskAssignee;
  comments: TaskComment[];
  employees: Record<string, unknown>[];
}

export async function fetchTaskDetail(taskId: string): Promise<TaskDetail> {
  if (USE_MOCK) {
    await delay();
    return {
      task: {},
      assign: { assignId: '', empId: '', empName: '' },
      comments: [],
      employees: [],
    };
  }

  const data = await get<{
    task?: Record<string, unknown>;
    assign?: Record<string, unknown>;
    comments?: Record<string, unknown>[];
    employee?: Record<string, unknown>[];
  }>(`tasks/${encodeURIComponent(taskId)}`);

  const assign = data?.assign ?? {};
  return {
    task: data?.task ?? {},
    assign: {
      assignId: pickString(assign, ['assign_id', 'id']),
      empId: pickString(assign, ['emp_id', 'employee_id']),
      empName: pickString(assign, ['emp_name', 'name', 'employee_name']),
    },
    comments: (data?.comments ?? []).map(row => ({
      id: pickString(row, ['comment_id', 'id']),
      comment: pickString(row, ['comment', 'text', 'description']),
      created: pickString(row, ['created', 'comment_date', 'date_created']),
    })),
    employees: data?.employee ?? [],
  };
}

/**
 * Form-encoded is required here: the model reads `comment` from `$_POST`, so a
 * JSON body arrives empty and the server answers 500.
 */
export async function addTaskComment(
  taskId: string,
  comment: string,
): Promise<boolean> {
  if (USE_MOCK) {
    await delay();
    return true;
  }
  await postForm<{ task_id?: number }>(
    `tasks/${encodeURIComponent(taskId)}/comments`,
    { comment: comment.trim(), task_id: taskId },
  );
  return true;
}

/**
 * The path segment is the *assignment* id from `data.assign.assign_id`, not the
 * task id. `taskid` is accepted for parity with the web form.
 */
export async function updateTaskStatus(
  assignId: string,
  status: string,
  taskId: string,
): Promise<boolean> {
  if (USE_MOCK) {
    await delay();
    return true;
  }
  await postForm<boolean>(
    `tasks/${encodeURIComponent(assignId)}/status`,
    { status, taskid: taskId },
  );
  return true;
}
