import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { CheckCircle2, MessageSquare } from 'lucide-react-native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { AlertBanner } from '../../shared/components/AlertBanner';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { TextField } from '../../shared/components/TextField';
import { useAuth } from '../../navigation/AuthContext';
import { P } from '../../services/permissions';
import {
  addTaskComment,
  fetchTaskDetail,
  updateTaskStatus,
  type TaskDetail,
} from '../../services/tasksService';
import { ApiError, describeApiError } from '../../services/httpClient';
import { humanizeKey } from '../../services/moduleService';
import type { RootStackParamList } from '../../navigation/types';

export function TaskDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'TaskDetail'>>();
  const { taskId } = route.params;
  const { can } = useAuth();
  const canEdit = can(P.tasksEdit);

  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await fetchTaskDetail(taskId));
    } catch (loadError) {
      setDetail(null);
      setError(describeApiError(loadError, 'Could not load this task.'));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const title =
    detail?.task?.title ??
    detail?.task?.task_title ??
    detail?.task?.name ??
    'Task';

  const completed =
    String(detail?.task?.status ?? detail?.task?.task_status ?? '') === '1';

  const taskFields = useMemo(() => {
    if (!detail?.task) {
      return [];
    }
    return Object.entries(detail.task)
      .filter(([, value]) => value !== null && value !== undefined && typeof value !== 'object')
      .slice(0, 8)
      .map(([key, value]) => ({
        label: humanizeKey(key),
        value: String(value),
      }));
  }, [detail?.task]);

  const submitComment = async () => {
    const trimmed = comment.trim();
    if (!trimmed) {
      setError('Write something first.');
      return;
    }
    setSendingComment(true);
    setError(null);
    try {
      await addTaskComment(taskId, trimmed);
      setComment('');
      await load();
    } catch (commentError) {
      setError(
        commentError instanceof ApiError && commentError.status === 403
          ? 'That lead belongs to another employee.'
          : describeApiError(commentError, 'Could not add the comment.'),
      );
    } finally {
      setSendingComment(false);
    }
  };

  const toggleStatus = async () => {
    if (!detail?.assign.assignId) {
      setError('This task has no assignment to update.');
      return;
    }
    setSavingStatus(true);
    setError(null);
    try {
      await updateTaskStatus(
        detail.assign.assignId,
        completed ? '0' : '1',
        taskId,
      );
      await load();
    } catch (statusError) {
      setError(describeApiError(statusError, 'Could not update the task.'));
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <DashboardLayout
      title={String(title)}
      subtitle={detail?.assign.empName || 'Task detail'}
      showGoBack
      showBell={false}
      onRefresh={load}
      refreshing={loading}>
      {error ? (
        <View className="mb-4">
          <AlertBanner message={error} />
        </View>
      ) : null}

      {loading && !detail ? (
        <View className="items-center py-10">
          <ActivityIndicator size="large" color="#5279AC" />
        </View>
      ) : null}

      {detail ? (
        <>
          <Card className="bg-white rounded-2xl p-4">
            <View className="flex-row items-center gap-2 mb-3">
              <View className="w-9 h-9 rounded-xl bg-primary-200 items-center justify-center">
                <CheckCircle2 size={17} color="#5279AC" />
              </View>
              <View className="flex-1">
                <Text className="font-lato-bold text-base text-neutral-900">
                  {completed ? 'Completed' : 'Open'}
                </Text>
                <Text className="font-lato text-xs text-neutral-600 mt-0.5">
                  {detail.assign.empName || 'Unassigned'}
                </Text>
              </View>
              {canEdit ? (
                <Button
                  title={completed ? 'Reopen' : 'Mark done'}
                  size="sm"
                  loading={savingStatus}
                  onPress={() => void toggleStatus()}
                />
              ) : null}
            </View>

            {taskFields.map(field => (
              <View
                key={field.label}
                className="flex-row gap-3 py-2 border-t border-neutral-200">
                <Text className="font-lato-bold text-xs text-neutral-600 w-28">
                  {field.label}
                </Text>
                <Text className="font-lato text-sm text-neutral-900 flex-1">
                  {field.value}
                </Text>
              </View>
            ))}
          </Card>

          <Card className="bg-white rounded-2xl p-4 mt-4">
            <Text className="font-lato-bold text-base text-neutral-900 mb-2">
              Comments
            </Text>

            {detail.comments.length === 0 ? (
              <Text className="font-lato text-sm text-neutral-600 py-3">
                No comments on this task yet.
              </Text>
            ) : (
              detail.comments.map((row, index) => (
                <View
                  key={row.id || index}
                  className="py-3"
                  style={
                    index > 0
                      ? { borderTopWidth: 1, borderTopColor: '#EEF0FF' }
                      : undefined
                  }>
                  <Text className="font-lato text-sm text-neutral-900 leading-5">
                    {row.comment}
                  </Text>
                  {row.created ? (
                    <Text className="font-lato text-[11px] text-neutral-600 mt-1">
                      {row.created}
                    </Text>
                  ) : null}
                </View>
              ))
            )}

            {canEdit ? (
              <View className="mt-3 pt-3 border-t border-neutral-200">
                <TextField
                  label="Add comment"
                  placeholder="Write an update…"
                  value={comment}
                  onChangeText={setComment}
                  multiline
                />
                <View className="flex-row justify-end">
                  <Button
                    title="Comment"
                    size="sm"
                    loading={sendingComment}
                    disabled={sendingComment || !comment.trim()}
                    icon={<MessageSquare size={14} color="#FFFFFF" />}
                    onPress={() => void submitComment()}
                  />
                </View>
              </View>
            ) : null}
          </Card>
        </>
      ) : null}

      {!loading && !detail && !error ? (
        <AlertBanner message="Task not found." />
      ) : null}
    </DashboardLayout>
  );
}
