// types
import type { List, Task } from '@/@types/index';

const DB_NAME = 'nova-task-pwa';
const DB_VERSION = 1;

const STORE_KV = 'kv';
const STORE_OUTBOX = 'outbox';

export const SNAPSHOT_KEYS = {
  tasks: 'tasksSnapshot',
  lists: 'listsSnapshot',
} as const;

export type TaskOutboxEntry =
  | { id: string; seq: number; kind: 'create'; clientTaskId: string; payload: Record<string, unknown> }
  | { id: string; seq: number; kind: 'update'; taskId: string; payload: Record<string, unknown> }
  | { id: string; seq: number; kind: 'delete'; taskId: string }
  | { id: string; seq: number; kind: 'toggleDone'; taskId: string }
  | { id: string; seq: number; kind: 'reorder'; items: { id: string; sortOrder: number }[] }
  | { id: string; seq: number; kind: 'clearCompleted'; listId: string };

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_KV)) {
          db.createObjectStore(STORE_KV, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
          db.createObjectStore(STORE_OUTBOX, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_KV, 'readonly');
      const store = tx.objectStore(STORE_KV);
      const req = store.get(key);
      req.onsuccess = () => {
        const row = req.result as { key: string; value: T } | undefined;
        resolve(row?.value ?? null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function kvSet<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_KV, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_KV).put({ key, value });
  });
}

export async function getTasksSnapshot(): Promise<Task[] | null> {
  return kvGet<Task[]>(SNAPSHOT_KEYS.tasks);
}

export async function setTasksSnapshot(tasks: Task[]): Promise<void> {
  await kvSet(SNAPSHOT_KEYS.tasks, tasks);
}

export async function getListsSnapshot(): Promise<List[] | null> {
  return kvGet<List[]>(SNAPSHOT_KEYS.lists);
}

export async function setListsSnapshot(lists: List[]): Promise<void> {
  await kvSet(SNAPSHOT_KEYS.lists, lists);
}

export async function getNextOutboxSeq(): Promise<number> {
  const rows = await getAllOutboxEntries();
  const max = rows.reduce((acc, row) => Math.max(acc, row.seq), 0);
  return max + 1;
}

export async function getAllOutboxEntries(): Promise<TaskOutboxEntry[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_OUTBOX, 'readonly');
      const store = tx.objectStore(STORE_OUTBOX);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = (req.result as TaskOutboxEntry[]) ?? [];
        rows.sort((a, b) => a.seq - b.seq);
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function putOutboxEntry(entry: TaskOutboxEntry): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_OUTBOX, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_OUTBOX).put(entry);
  });
}

export async function deleteOutboxEntry(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_OUTBOX, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_OUTBOX).delete(id);
  });
}

export async function clearOutbox(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_OUTBOX, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_OUTBOX).clear();
  });
}
