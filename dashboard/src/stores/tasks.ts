// node_modules
import dayjs from 'dayjs';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

// classes
import { type TaskListParams, taskApi } from '@/classes/api';

// lib
import { getTasksSnapshot, setTasksSnapshot } from '@/lib/pwa-offline-db';
import {
  browserReportsOnline,
  enqueueClearCompleted,
  enqueueReorder,
  enqueueTaskCreate,
  enqueueTaskDelete,
  enqueueTaskUpdate,
  enqueueToggleDone,
  filterCachedTasks,
  flushTaskOutbox,
  generateLocalTaskId,
  isLocalTaskId,
  persistMergedTaskSnapshot,
  refreshPendingMutationCount,
  removePendingOfflineCreate,
} from '@/lib/pwa-offline-tasks';
import { isDueToday, isDueSoon, isOverdue } from '@/lib/utils';

// stores
import { useAuthStore } from '@/stores/auth';
import { useTagsStore } from '@/stores/tags';

// types
import type { Task } from '@/@types/index';

async function replaceTaskInSnapshot(updated: Task): Promise<void> {
  const snap = (await getTasksSnapshot()) ?? [];
  const idx = snap.findIndex((t) => t.id === updated.id);
  let next: Task[];
  if (idx >= 0) {
    next = [...snap];
    next[idx] = updated;
  } else {
    next = [...snap, updated];
  }
  await setTasksSnapshot(next);
}

async function removeTaskFromSnapshot(taskId: string): Promise<void> {
  const snap = (await getTasksSnapshot()) ?? [];
  await setTasksSnapshot(snap.filter((t) => t.id !== taskId));
}

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([]);

  const tasksByListId = computed(() => {
    const map: Record<string, Task[]> = {};
    for (const task of tasks.value) {
      if (!map[task.listId]) {
        map[task.listId] = [];
      }
      map[task.listId]!.push(task);
    }
    return map;
  });

  function topLevelTasks(listId: string): Task[] {
    return tasks.value.filter((task) => task.listId === listId && !task.parentTaskId);
  }

  function subTasksOf(taskId: string): Task[] {
    return tasks.value.filter((task) => task.parentTaskId === taskId);
  }

  function doneTasks(listId: string): Task[] {
    return topLevelTasks(listId).filter((task) => task.done);
  }

  function activeTasks(listId: string): Task[] {
    return topLevelTasks(listId).filter((task) => !task.done);
  }

  const overdueTasks = computed(() => {
    return tasks.value.filter(
      (task) => !task.parentTaskId && isOverdue(task.dueDate, task.done, task.dueDateHasTime),
    );
  });

  const upcomingTasks = computed(() => {
    const end = dayjs().add(7, 'day');
    return tasks.value.filter((task) => {
      if (task.parentTaskId || task.done || !task.dueDate) {
        return false;
      }
      const d = dayjs(task.dueDate);
      return d.isBefore(end) || d.isSame(end, 'day');
    });
  });

  async function fetchTasks(params?: TaskListParams): Promise<void> {
    try {
      let raw = await taskApi.list(params);
      let data = Array.isArray(raw) ? raw : [];

      // A list-scoped GET can incorrectly return [] (SW/proxy quirks). Always confirm against a
      // full task read before we persist, so we never merge an empty slice over real tasks.
      if (params?.listId && data.length === 0) {
        try {
          const fullRaw = await taskApi.list();
          const full = Array.isArray(fullRaw) ? fullRaw : [];
          data = full.filter((t) => t.listId === params.listId);
        } catch {
          const snap = await getTasksSnapshot();
          data = snap?.length ? filterCachedTasks(snap, { listId: params.listId }) : [];
        }
      }

      if (params?.listId) {
        const lid = params.listId;
        const rest = tasks.value.filter((t) => t.listId !== lid);
        tasks.value = [...rest, ...data];
      } else {
        // Full fetch: do not wipe in-memory tasks on a spurious empty response (navigator.onLine races, SW quirks).
        if (data.length === 0 && tasks.value.length > 0) {
          await persistMergedTaskSnapshot(data, params);
          void flushTaskOutbox();
          return;
        }
        tasks.value = data;
        if (data.length === 0) {
          const snap = await getTasksSnapshot();
          if (snap?.length) {
            tasks.value = snap;
          }
        }
      }

      await persistMergedTaskSnapshot(data, params);
      void flushTaskOutbox();
    } catch {
      const snap = await getTasksSnapshot();
      if (snap?.length) {
        tasks.value = filterCachedTasks(snap, params);
        return;
      }
      throw new Error('Unable to load tasks');
    }
  }

  function assembleTaskWithSubtasks(all: Task[], id: string): Task {
    const root = all.find((t) => t.id === id);
    if (!root) {
      throw new Error('Task not found');
    }
    const subs = all.filter((t) => t.parentTaskId === id);
    return { ...root, subTasks: subs };
  }

  async function fetchTask(id: string): Promise<Task> {
    const fromMemory = (): Task | null => {
      const hit = tasks.value.find((t) => t.id === id);
      if (!hit) {
        return null;
      }
      return assembleTaskWithSubtasks(tasks.value, id);
    };

    try {
      return await taskApi.get(id);
    } catch {
      const mem = fromMemory();
      if (mem) {
        return mem;
      }
      const snap = await getTasksSnapshot();
      if (snap?.length) {
        const hit = snap.find((t) => t.id === id);
        if (hit) {
          return assembleTaskWithSubtasks(snap, id);
        }
      }
      throw new Error('Task not found');
    }
  }

  function computeNextSortOrder(
    snapshot: Task[],
    listId: string,
    parentTaskId: string | null,
  ): number {
    const p = parentTaskId ?? null;
    const siblings = snapshot.filter(
      (t) => t.listId === listId && (t.parentTaskId ?? null) === p,
    );
    let max = -1;
    for (const t of siblings) {
      if (t.sortOrder > max) {
        max = t.sortOrder;
      }
    }
    return max + 1;
  }

  function buildOptimisticTask(
    id: string,
    payload: Record<string, unknown>,
    tags: Task['tags'],
    sortOrder: number,
  ): Task {
    const auth = useAuthStore();
    const now = new Date().toISOString();
    return {
      id,
      listId: String(payload['listId']),
      userId: auth.userId ?? 'offline',
      title: String(payload['title']),
      description: (payload['description'] as string | null | undefined) ?? null,
      dueDate: (payload['dueDate'] as string | null | undefined) ?? null,
      dueDateHasTime: Boolean(payload['dueDateHasTime']),
      priority: (payload['priority'] as Task['priority']) ?? 'NONE',
      done: false,
      doneAt: null,
      sortOrder,
      createdAt: now,
      updatedAt: now,
      parentTaskId: (payload['parentTaskId'] as string | null | undefined) ?? null,
      tags,
      recurringRule: null,
      reminderOffset:
        (payload['reminderOffset'] as number | null | undefined) === undefined
          ? null
          : (payload['reminderOffset'] as number | null),
    };
  }

  async function createTask(payload: Record<string, unknown>): Promise<Task> {
    if (!browserReportsOnline()) {
      const tagsStore = useTagsStore();
      const rawTagIds = (payload['tagIds'] as string[] | undefined) ?? [];
      const tags = rawTagIds
        .map((tid) => tagsStore.tagById(tid))
        .filter((t): t is NonNullable<typeof t> => Boolean(t));
      const localId = generateLocalTaskId();
      const snap = (await getTasksSnapshot()) ?? tasks.value;
      const listIdStr = String(payload['listId']);
      const parentRaw = payload['parentTaskId'];
      const parentId: string | null =
        parentRaw === undefined ? null : (parentRaw as string | null);
      const sortOrder = computeNextSortOrder(snap, listIdStr, parentId);
      const optimistic = buildOptimisticTask(localId, payload, tags, sortOrder);
      tasks.value = [...tasks.value, optimistic];
      await replaceTaskInSnapshot(optimistic);
      await enqueueTaskCreate(localId, payload);
      await refreshPendingMutationCount();
      return optimistic;
    }

    const created = await taskApi.create(payload);
    await fetchTasks();
    return created;
  }

  async function updateTask(id: string, payload: Record<string, unknown>): Promise<Task> {
    if (!browserReportsOnline()) {
      const current =
        tasks.value.find((t) => t.id === id) ?? (await getTasksSnapshot())?.find((t) => t.id === id);
      if (!current) {
        throw new Error('Task not found');
      }
      const tagsStore = useTagsStore();
      let nextTags = current.tags;
      if (Array.isArray(payload['tagIds'])) {
        const ids = payload['tagIds'] as string[];
        nextTags = ids
          .map((tid) => tagsStore.tagById(tid))
          .filter((t): t is NonNullable<typeof t> => Boolean(t));
      }
      const updated: Task = {
        ...current,
        title: (payload['title'] as string | undefined) ?? current.title,
        description:
          payload['description'] !== undefined
            ? (payload['description'] as string | null)
            : current.description,
        dueDate:
          payload['dueDate'] !== undefined
            ? (payload['dueDate'] as string | null)
            : current.dueDate,
        dueDateHasTime:
          payload['dueDateHasTime'] !== undefined
            ? Boolean(payload['dueDateHasTime'])
            : current.dueDateHasTime,
        priority: (payload['priority'] as Task['priority'] | undefined) ?? current.priority,
        tags: nextTags,
        reminderOffset:
          payload['reminderOffset'] !== undefined
            ? (payload['reminderOffset'] as number | null)
            : current.reminderOffset,
        updatedAt: new Date().toISOString(),
      };
      tasks.value = tasks.value.map((t) => (t.id === id ? updated : t));
      await replaceTaskInSnapshot(updated);
      await enqueueTaskUpdate(id, payload);
      return updated;
    }

    const updated = await taskApi.update(id, payload);
    await fetchTasks();
    return updated;
  }

  async function deleteTask(id: string): Promise<void> {
    if (isLocalTaskId(id)) {
      await removePendingOfflineCreate(id);
      tasks.value = tasks.value.filter((t) => t.id !== id);
      await removeTaskFromSnapshot(id);
      await refreshPendingMutationCount();
      return;
    }

    if (!browserReportsOnline()) {
      tasks.value = tasks.value.filter((t) => t.id !== id);
      await removeTaskFromSnapshot(id);
      await enqueueTaskDelete(id);
      return;
    }

    await taskApi.delete(id);
    await fetchTasks();
  }

  async function toggleDone(id: string): Promise<void> {
    const resolveCurrent = async (): Promise<Task | undefined> => {
      return (
        tasks.value.find((t) => t.id === id) ?? (await getTasksSnapshot())?.find((t) => t.id === id)
      );
    };

    if (!browserReportsOnline()) {
      const cur = await resolveCurrent();
      if (!cur) {
        return;
      }
      const nextDone = !cur.done;
      const updated: Task = {
        ...cur,
        done: nextDone,
        doneAt: nextDone ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      };
      tasks.value = tasks.value.map((t) => (t.id === id ? updated : t));
      await replaceTaskInSnapshot(updated);
      await enqueueToggleDone(id);
      return;
    }

    await taskApi.toggleDone(id);
    await fetchTasks();
  }

  async function reorderTasks(items: { id: string; sortOrder: number }[]): Promise<void> {
    if (!browserReportsOnline()) {
      const snap = (await getTasksSnapshot()) ?? [];
      const byId = new Map(snap.map((t) => [t.id, t]));
      const now = new Date().toISOString();
      for (const it of items) {
        const cur = byId.get(it.id);
        if (cur) {
          byId.set(it.id, { ...cur, sortOrder: it.sortOrder, updatedAt: now });
        }
      }
      await setTasksSnapshot([...byId.values()]);
      tasks.value = tasks.value.map((t) => byId.get(t.id) ?? t);
      await enqueueReorder(items);
      return;
    }

    await taskApi.reorder(items);
    await fetchTasks();
  }

  async function clearCompleted(listId: string): Promise<void> {
    if (!browserReportsOnline()) {
      const snap = (await getTasksSnapshot()) ?? [];
      const nextSnap = snap.filter((t) => !(t.listId === listId && t.done));
      await setTasksSnapshot(nextSnap);
      tasks.value = tasks.value.filter((t) => !(t.listId === listId && t.done));
      await enqueueClearCompleted(listId);
      return;
    }

    await taskApi.clearCompleted(listId);
    await fetchTasks();
  }

  function dueTodayTasks(): Task[] {
    return tasks.value.filter(
      (task) => !task.parentTaskId && !task.done && isDueToday(task.dueDate),
    );
  }

  function dueThisWeekTasks(): Task[] {
    return tasks.value.filter((task) => {
      if (task.parentTaskId || task.done || !task.dueDate) {
        return false;
      }
      if (isOverdue(task.dueDate, false, task.dueDateHasTime) || isDueToday(task.dueDate)) {
        return false;
      }
      return isDueSoon(task.dueDate, 7);
    });
  }

  return {
    tasks,
    tasksByListId,
    topLevelTasks,
    subTasksOf,
    doneTasks,
    activeTasks,
    overdueTasks,
    upcomingTasks,
    fetchTasks,
    fetchTask,
    createTask,
    updateTask,
    deleteTask,
    toggleDone,
    reorderTasks,
    clearCompleted,
    dueTodayTasks,
    dueThisWeekTasks,
  };
});
