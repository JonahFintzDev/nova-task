// node_modules
import { ref } from 'vue';

// classes
import {
  getApiReachable,
  type TaskListParams,
  subscribeApiReachable,
  taskApi,
} from '@/classes/api';

// lib
import {
  deleteOutboxEntry,
  getAllOutboxEntries,
  getNextOutboxSeq,
  getTasksSnapshot,
  putOutboxEntry,
  setTasksSnapshot,
  type TaskOutboxEntry,
} from '@/lib/pwa-offline-db';

// types
import type { Task } from '@/@types/index';

export const LOCAL_TASK_ID_PREFIX = 'offline:task:';

export const pendingTaskMutations = ref(0);

export function isLocalTaskId(id: string): boolean {
  return id.startsWith(LOCAL_TASK_ID_PREFIX);
}

export function generateLocalTaskId(): string {
  return `${LOCAL_TASK_ID_PREFIX}${crypto.randomUUID()}`;
}

export function browserReportsOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

export async function refreshPendingMutationCount(): Promise<void> {
  const rows = await getAllOutboxEntries();
  pendingTaskMutations.value = rows.length;
}

export function filterCachedTasks(tasks: Task[], params?: TaskListParams): Task[] {
  let out = [...tasks];
  if (params?.listId) {
    out = out.filter((t) => t.listId === params.listId);
  }
  if (params?.parentTaskId === null) {
    out = out.filter((t) => t.parentTaskId === null);
  } else if (params?.parentTaskId) {
    out = out.filter((t) => t.parentTaskId === params.parentTaskId);
  }
  if (params?.done === true) {
    out = out.filter((t) => t.done);
  } else if (params?.done === false) {
    out = out.filter((t) => !t.done);
  }
  if (params?.priority) {
    out = out.filter((t) => t.priority === params.priority);
  }
  if (params?.tagId) {
    out = out.filter((t) => t.tags.some((tag) => tag.id === params.tagId));
  }
  return out;
}

/** Merge an API list response into the persisted full snapshot. */
export function mergeTasksIntoSnapshot(
  previous: Task[] | null,
  fetched: Task[],
  params?: TaskListParams,
): Task[] {
  const hasListFilter = Boolean(params?.listId);
  const isFullFetch =
    !hasListFilter &&
    params?.parentTaskId === undefined &&
    params?.done === undefined &&
    params?.priority === undefined &&
    params?.tagId === undefined;

  if (isFullFetch) {
    // A bogus empty full response must not erase a good local snapshot (e.g. SW / race after list load).
    if (fetched.length === 0 && previous && previous.length > 0) {
      return previous;
    }
    return fetched;
  }

  const base = previous ? [...previous] : [];
  if (hasListFilter && params?.listId) {
    const lid = params.listId;
    const kept = base.filter((t) => t.listId !== lid);
    return [...kept, ...fetched];
  }

  const byId = new Map<string, Task>();
  for (const t of base) {
    byId.set(t.id, t);
  }
  for (const t of fetched) {
    byId.set(t.id, t);
  }
  return [...byId.values()];
}

export async function persistMergedTaskSnapshot(
  fetched: Task[],
  params?: TaskListParams,
): Promise<Task[]> {
  const previous = await getTasksSnapshot();
  const merged = mergeTasksIntoSnapshot(previous, fetched, params);
  await setTasksSnapshot(merged);
  return merged;
}

async function findPendingCreate(clientTaskId: string): Promise<TaskOutboxEntry | null> {
  const rows = await getAllOutboxEntries();
  const hit = rows.find((r) => r.kind === 'create' && r.clientTaskId === clientTaskId);
  return hit && hit.kind === 'create' ? hit : null;
}

const CREATE_BODY_KEYS = [
  'listId',
  'title',
  'description',
  'dueDate',
  'dueDateHasTime',
  'priority',
  'parentTaskId',
  'tagIds',
  'reminderOffset',
] as const;

/** Strip unknown keys so queued creates match the API body schema. */
export function sanitizeTaskCreatePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of CREATE_BODY_KEYS) {
    if (key in payload) {
      out[key] = payload[key];
    }
  }
  out['listId'] = String(payload['listId']);
  out['title'] = String(payload['title']);
  return out;
}

export async function enqueueTaskCreate(
  clientTaskId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const seq = await getNextOutboxSeq();
  await putOutboxEntry({
    id: crypto.randomUUID(),
    seq,
    kind: 'create',
    clientTaskId,
    payload: sanitizeTaskCreatePayload(payload),
  });
  await refreshPendingMutationCount();
}

export async function enqueueTaskUpdate(
  taskId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (isLocalTaskId(taskId)) {
    const pending = await findPendingCreate(taskId);
    if (pending && pending.kind === 'create') {
      Object.assign(pending.payload, payload);
      await putOutboxEntry(pending);
      await refreshPendingMutationCount();
      return;
    }
  }
  const seq = await getNextOutboxSeq();
  await putOutboxEntry({
    id: crypto.randomUUID(),
    seq,
    kind: 'update',
    taskId,
    payload: { ...payload },
  });
  await refreshPendingMutationCount();
}

/** Drop a queued offline create (and dependent ops) without calling the API. */
export async function removePendingOfflineCreate(clientTaskId: string): Promise<boolean> {
  const rows = await getAllOutboxEntries();
  const createRow = rows.find((r) => r.kind === 'create' && r.clientTaskId === clientTaskId);
  if (!createRow) {
    return false;
  }
  await deleteOutboxEntry(createRow.id);
  const dependents = rows.filter(
    (r) =>
      r.id !== createRow.id &&
      ((r.kind === 'update' && r.taskId === clientTaskId) ||
        (r.kind === 'delete' && r.taskId === clientTaskId) ||
        (r.kind === 'toggleDone' && r.taskId === clientTaskId)),
  );
  for (const d of dependents) {
    await deleteOutboxEntry(d.id);
  }
  await refreshPendingMutationCount();
  return true;
}

export async function enqueueTaskDelete(taskId: string): Promise<void> {
  const seq = await getNextOutboxSeq();
  await putOutboxEntry({
    id: crypto.randomUUID(),
    seq,
    kind: 'delete',
    taskId,
  });
  await refreshPendingMutationCount();
}

export async function enqueueToggleDone(taskId: string): Promise<void> {
  const seq = await getNextOutboxSeq();
  await putOutboxEntry({
    id: crypto.randomUUID(),
    seq,
    kind: 'toggleDone',
    taskId,
  });
  await refreshPendingMutationCount();
}

export async function enqueueReorder(items: { id: string; sortOrder: number }[]): Promise<void> {
  const seq = await getNextOutboxSeq();
  await putOutboxEntry({
    id: crypto.randomUUID(),
    seq,
    kind: 'reorder',
    items: items.map((i) => ({ ...i })),
  });
  await refreshPendingMutationCount();
}

export async function enqueueClearCompleted(listId: string): Promise<void> {
  const seq = await getNextOutboxSeq();
  await putOutboxEntry({
    id: crypto.randomUUID(),
    seq,
    kind: 'clearCompleted',
    listId,
  });
  await refreshPendingMutationCount();
}

function remapTaskIdInPayload(payload: Record<string, unknown>, from: string, to: string): void {
  if (payload['parentTaskId'] === from) {
    payload['parentTaskId'] = to;
  }
}

async function remapOutboxAfterCreate(from: string, to: string): Promise<void> {
  const rows = await getAllOutboxEntries();
  for (const row of rows) {
    if (row.kind === 'create') {
      remapTaskIdInPayload(row.payload, from, to);
      await putOutboxEntry(row);
    } else if (row.kind === 'update' && row.taskId === from) {
      row.taskId = to;
      await putOutboxEntry(row);
    } else if (row.kind === 'delete' && row.taskId === from) {
      row.taskId = to;
      await putOutboxEntry(row);
    } else if (row.kind === 'toggleDone' && row.taskId === from) {
      row.taskId = to;
      await putOutboxEntry(row);
    } else if (row.kind === 'reorder') {
      for (const it of row.items) {
        if (it.id === from) {
          it.id = to;
        }
      }
      await putOutboxEntry(row);
    }
  }
}

function replaceTaskIdInArray(tasks: Task[], from: string, to: string, patch: Partial<Task>): Task[] {
  return tasks.map((t) => {
    if (t.id === from) {
      return { ...t, ...patch, id: to };
    }
    return {
      ...t,
      parentTaskId: t.parentTaskId === from ? to : t.parentTaskId,
    };
  });
}

let flushPromise: Promise<void> | null = null;

export function flushTaskOutbox(): Promise<void> {
  if (flushPromise) {
    return flushPromise;
  }
  flushPromise = (async () => {
    let didFlushWork = false;
    try {
      if (!browserReportsOnline()) {
        return;
      }
      for (;;) {
        const rows = await getAllOutboxEntries();
        if (!rows.length) {
          break;
        }
        const row = rows[0]!;
        try {
          if (row.kind === 'create') {
            const { clientTaskId, payload } = row;
            const created = await taskApi.create(sanitizeTaskCreatePayload(payload));
            await remapOutboxAfterCreate(clientTaskId, created.id);
            const snap = await getTasksSnapshot();
            const next = snap
              ? replaceTaskIdInArray(snap, clientTaskId, created.id, created)
              : [created];
            await setTasksSnapshot(next);
            await deleteOutboxEntry(row.id);
          } else if (row.kind === 'update') {
            await taskApi.update(row.taskId, row.payload);
            await deleteOutboxEntry(row.id);
          } else if (row.kind === 'delete') {
            await taskApi.delete(row.taskId);
            await deleteOutboxEntry(row.id);
          } else if (row.kind === 'toggleDone') {
            await taskApi.toggleDone(row.taskId);
            await deleteOutboxEntry(row.id);
          } else if (row.kind === 'reorder') {
            await taskApi.reorder(row.items);
            await deleteOutboxEntry(row.id);
          } else if (row.kind === 'clearCompleted') {
            await taskApi.clearCompleted(row.listId);
            await deleteOutboxEntry(row.id);
          }
          didFlushWork = true;
        } catch {
          break;
        }
        await refreshPendingMutationCount();
      }
    } finally {
      await refreshPendingMutationCount();
      flushPromise = null;
      if (typeof window !== 'undefined' && didFlushWork) {
        window.dispatchEvent(new CustomEvent('nova-task-outbox-flushed'));
      }
    }
  })();
  return flushPromise;
}

let listenersStarted = false;

export function startPwaOfflineTaskListeners(): void {
  if (listenersStarted || typeof window === 'undefined') {
    return;
  }
  listenersStarted = true;
  void refreshPendingMutationCount();
  window.addEventListener('online', () => {
    void flushTaskOutbox();
  });
  subscribeApiReachable((online) => {
    if (online && browserReportsOnline()) {
      void flushTaskOutbox();
    }
  });
  if (browserReportsOnline() && getApiReachable()) {
    void flushTaskOutbox();
  }
}
