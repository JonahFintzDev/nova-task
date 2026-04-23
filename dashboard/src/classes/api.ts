// node_modules
import axios, { type AxiosInstance } from 'axios';

// types
import type {
  ActivityLog,
  ApiKey,
  ApiKeyWithPlainKey,
  AppSettings,
  CalendarFeed,
  CalendarFeedWithToken,
  Comment,
  List,
  ListShare,
  RecurringRule,
  Tag,
  Task,
  User,
  UserSettings,
} from '@/@types/index';
import type { Priority } from '@/@types/index';

const TOKEN_KEY = 'nova-task-token';

export const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  timeout: 30000,
});

let bApiReachable = true;
const reachabilityListeners = new Set<(online: boolean) => void>();

export function getApiReachable(): boolean {
  return bApiReachable;
}

export function subscribeApiReachable(listener: (online: boolean) => void): () => void {
  reachabilityListeners.add(listener);
  return () => {
    reachabilityListeners.delete(listener);
  };
}

function setApiReachable(online: boolean): void {
  if (bApiReachable === online) {
    return;
  }
  bApiReachable = online;
  for (const listener of reachabilityListeners) {
    listener(online);
  }
}

api.interceptors.request.use((configuration) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    configuration.headers.Authorization = `Bearer ${token}`;
  }
  return configuration;
});

api.interceptors.response.use(
  (response) => {
    setApiReachable(true);
    return response;
  },
  (error) => {
    if (!error.response && error.code !== 'ERR_CANCELED') {
      setApiReachable(false);
    } else if (error.response) {
      setApiReachable(true);
    }
    return Promise.reject(error);
  },
);

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

// -------------------------------------------------- Health --------------------------------------------------

export const healthApi = {
  async check(): Promise<{
    ok: boolean;
    needsSetup: boolean;
    registrationEnabled: boolean;
    commentsEnabled: boolean;
  }> {
    const response = await api.get<{
      ok: boolean;
      needsSetup: boolean;
      registrationEnabled: boolean;
      commentsEnabled: boolean;
    }>('/api/health');
    return response.data;
  },
};

// -------------------------------------------------- Auth --------------------------------------------------

export const authApi = {
  async register(username: string, password: string): Promise<{ token: string }> {
    const response = await api.post<{ token: string }>('/api/auth/register', {
      username,
      password,
    });
    return response.data;
  },
  async login(username: string, password: string): Promise<{ token: string }> {
    const response = await api.post<{ token: string }>('/api/auth/login', { username, password });
    return response.data;
  },
  async validate(): Promise<{
    valid: boolean;
    username: string | null;
    userId: string | null;
    isAdmin: boolean;
    avatarUrl?: string | null;
  }> {
    const response = await api.post<{
      valid: boolean;
      username: string | null;
      userId: string | null;
      isAdmin: boolean;
      avatarUrl?: string | null;
    }>('/api/auth/validate');
    return response.data;
  },
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.patch('/api/auth/password', { currentPassword, newPassword });
  },
};

// -------------------------------------------------- Lists --------------------------------------------------

export const listApi = {
  async list(): Promise<List[]> {
    const response = await api.get<List[]>('/api/lists');
    return response.data;
  },
  async create(payload: Partial<List> & { title: string }): Promise<List> {
    const response = await api.post<List>('/api/lists', payload);
    return response.data;
  },
  async update(id: string, payload: Partial<List>): Promise<List> {
    const response = await api.patch<List>(`/api/lists/${id}`, payload);
    return response.data;
  },
  async delete(id: string): Promise<void> {
    await api.delete(`/api/lists/${id}`);
  },
  async reorder(items: { id: string; sortOrder: number }[]): Promise<void> {
    await api.patch('/api/lists/reorder', { items });
  },
};

// -------------------------------------------------- Tasks --------------------------------------------------

export interface TaskListParams {
  listId?: string;
  parentTaskId?: string | null;
  done?: boolean;
  priority?: Priority;
  tagId?: string;
}

export const taskApi = {
  async list(params?: TaskListParams): Promise<Task[]> {
    const response = await api.get<Task[]>('/api/tasks', { params });
    return response.data;
  },
  async get(id: string): Promise<Task> {
    const response = await api.get<Task>(`/api/tasks/${id}`);
    return response.data;
  },
  async create(payload: Record<string, unknown>): Promise<Task> {
    const response = await api.post<Task>('/api/tasks', payload);
    return response.data;
  },
  async update(id: string, payload: Record<string, unknown>): Promise<Task> {
    const response = await api.patch<Task>(`/api/tasks/${id}`, payload);
    return response.data;
  },
  async delete(id: string): Promise<void> {
    await api.delete(`/api/tasks/${id}`);
  },
  async toggleDone(id: string): Promise<Task> {
    const response = await api.patch<Task>(`/api/tasks/${id}/done`);
    return response.data;
  },
  async reorder(items: { id: string; sortOrder: number }[]): Promise<void> {
    await api.patch('/api/tasks/reorder', { items });
  },
  async clearCompleted(listId: string): Promise<{ deleted: number }> {
    const response = await api.post<{ deleted: number }>('/api/tasks/clear-completed', { listId });
    return response.data;
  },
};

// -------------------------------------------------- Tags --------------------------------------------------

export const tagApi = {
  async list(): Promise<Tag[]> {
    const response = await api.get<Tag[]>('/api/tags');
    return response.data;
  },
  async create(payload: { name: string; color?: string | null }): Promise<Tag> {
    const response = await api.post<Tag>('/api/tags', payload);
    return response.data;
  },
  async update(id: string, payload: { name?: string; color?: string | null }): Promise<Tag> {
    const response = await api.patch<Tag>(`/api/tags/${id}`, payload);
    return response.data;
  },
  async delete(id: string): Promise<void> {
    await api.delete(`/api/tags/${id}`);
  },
};

// -------------------------------------------------- Search --------------------------------------------------

export const searchApi = {
  async search(
    query: string,
    params?: { listId?: string; done?: boolean; priority?: Priority; tagId?: string },
  ): Promise<{ lists: List[]; tasks: Task[] }> {
    const response = await api.get<{ lists: List[]; tasks: Task[] }>('/api/search', {
      params: { q: query, ...params },
    });
    return response.data;
  },
};

// -------------------------------------------------- Settings --------------------------------------------------

export const settingsApi = {
  async get(): Promise<UserSettings> {
    const response = await api.get<UserSettings>('/api/settings');
    return response.data;
  },
  async update(payload: Partial<UserSettings>): Promise<UserSettings> {
    const response = await api.patch<UserSettings>('/api/settings', payload);
    return response.data;
  },
};

// -------------------------------------------------- Calendar --------------------------------------------------

export const calendarApi = {
  async listFeeds(): Promise<CalendarFeed[]> {
    const response = await api.get<CalendarFeed[]>('/api/calendar/feeds');
    return response.data;
  },
  async createFeed(payload: {
    name?: string | null;
    includeDone?: boolean;
    listIds?: string[];
  }): Promise<CalendarFeedWithToken> {
    const response = await api.post<CalendarFeedWithToken>('/api/calendar/feeds', payload);
    return response.data;
  },
  async updateFeed(
    id: string,
    payload: {
      name?: string | null;
      includeDone?: boolean;
      listIds?: string[];
    },
  ): Promise<CalendarFeed> {
    const response = await api.patch<CalendarFeed>(`/api/calendar/feeds/${id}`, payload);
    return response.data;
  },
  async rotateFeed(id: string): Promise<{ token: string }> {
    const response = await api.post<{ token: string }>(`/api/calendar/feeds/${id}/rotate`);
    return response.data;
  },
  async deleteFeed(id: string): Promise<void> {
    await api.delete(`/api/calendar/feeds/${id}`);
  },
};

// -------------------------------------------------- Push --------------------------------------------------

export const pushApi = {
  async getPublicKey(): Promise<{ enabled: boolean; publicKey: string | null }> {
    const response = await api.get<{ enabled: boolean; publicKey: string | null }>(
      '/api/push/public-key',
    );
    return response.data;
  },
  async subscribe(payload: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }): Promise<void> {
    await api.post('/api/push/subscribe', payload);
  },
  async unsubscribe(endpoint: string): Promise<void> {
    await api.post('/api/push/unsubscribe', { endpoint });
  },
};

// -------------------------------------------------- Recurrence --------------------------------------------------

export const recurrenceApi = {
  async get(taskId: string): Promise<RecurringRule | null> {
    const response = await api.get<RecurringRule | null>(`/api/tasks/${taskId}/recurrence`);
    return response.data;
  },
  async set(
    taskId: string,
    payload: { frequency: RecurringRule['frequency']; interval: number },
  ): Promise<RecurringRule> {
    const response = await api.put<RecurringRule>(`/api/tasks/${taskId}/recurrence`, payload);
    return response.data;
  },
  async remove(taskId: string): Promise<void> {
    await api.delete(`/api/tasks/${taskId}/recurrence`);
  },
};

// -------------------------------------------------- Admin --------------------------------------------------

export const adminApi = {
  async listUsers(): Promise<User[]> {
    const response = await api.get<User[]>('/api/admin/users');
    return response.data;
  },
  async updateUser(id: string, payload: { isAdmin?: boolean }): Promise<User> {
    const response = await api.patch<User>(`/api/admin/users/${id}`, payload);
    return response.data;
  },
  async deleteUser(id: string): Promise<void> {
    await api.delete(`/api/admin/users/${id}`);
  },
  async getSettings(): Promise<AppSettings> {
    const response = await api.get<AppSettings>('/api/admin/settings');
    return response.data;
  },
  async updateSettings(payload: Partial<AppSettings>): Promise<AppSettings> {
    const response = await api.patch<AppSettings>('/api/admin/settings', payload);
    return response.data;
  },
  async testAi(payload: {
    aiApiUrl?: string | null;
    aiApiKey?: string | null;
    aiModel?: string | null;
  }): Promise<{ ok: boolean; error?: string }> {
    const response = await api.post<{ ok: boolean; error?: string }>(
      '/api/admin/ai/test',
      payload,
    );
    return response.data;
  },
};

// -------------------------------------------------- AI --------------------------------------------------

export const aiApi = {
  async suggest(
    listId: string,
    prompt: string,
    taskId?: string,
  ): Promise<{ requestId: string }> {
    const response = await api.post<{ requestId: string }>('/api/ai/suggest', {
      listId,
      prompt,
      ...(taskId ? { taskId } : {}),
    });
    return response.data;
  },
};

// -------------------------------------------------- API Keys --------------------------------------------------

export const apiKeysApi = {
  async list(): Promise<ApiKey[]> {
    const response = await api.get<ApiKey[]>('/api/keys');
    return response.data;
  },
  async create(name: string): Promise<ApiKeyWithPlainKey> {
    const response = await api.post<ApiKeyWithPlainKey>('/api/keys', { name });
    return response.data;
  },
  async delete(id: string): Promise<void> {
    await api.delete(`/api/keys/${id}`);
  },
};

// -------------------------------------------------- Avatar --------------------------------------------------

export const avatarApi = {
  async upload(file: File): Promise<{ avatarUrl: string }> {
    const form = new FormData();
    form.append('avatar', file);
    const response = await api.post<{ avatarUrl: string }>('/api/users/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  async remove(): Promise<void> {
    await api.delete('/api/users/avatar');
  },
};

// -------------------------------------------------- WebSocket --------------------------------------------------

export type WsMessage =
  | { type: 'ai:chunk'; requestId: string; listId: string; title: string }
  | { type: 'ai:done'; requestId: string }
  | { type: 'ai:error'; requestId: string; message: string }
  | { type: 'pong' };

type WsListener = (msg: WsMessage) => void;

class AppWebSocket {
  private ws: WebSocket | null = null;
  private listeners = new Set<WsListener>();
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private shouldConnect = false;

  connect(): void {
    this.shouldConnect = true;
    this.open();
  }

  disconnect(): void {
    this.shouldConnect = false;
    this.cleanup();
  }

  on(listener: WsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private open(): void {
    if (this.ws) return;
    const token = getStoredToken();
    if (!token) return;

    const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
    const wsBase = baseUrl
      ? baseUrl.replace(/^http/, 'ws')
      : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

    this.ws = new WebSocket(`${wsBase}/api/ws?token=${encodeURIComponent(token)}`);

    this.ws.onopen = () => {
      this.pingInterval = setInterval(() => {
        this.ws?.send(JSON.stringify({ type: 'ping' }));
      }, 30_000);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WsMessage;
        for (const listener of this.listeners) {
          listener(msg);
        }
      } catch {
        // ignore malformed
      }
    };

    this.ws.onclose = () => {
      this.cleanup();
      if (this.shouldConnect) {
        this.reconnectTimeout = setTimeout(() => this.open(), 5_000);
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
  }
}

export const appWs = new AppWebSocket();

// -------------------------------------------------- Collaboration --------------------------------------------------

export const collaborationApi = {
  // Shared lists
  async listShared(): Promise<
    (ListShare & { list: List & { user: Pick<User, 'id' | 'username'>; taskCount: number } })[]
  > {
    const response =
      await api.get<
        (ListShare & { list: List & { user: Pick<User, 'id' | 'username'>; taskCount: number } })[]
      >('/api/shared-lists');
    return response.data;
  },

  // List shares management
  async listShares(
    listId: string,
  ): Promise<(ListShare & { user: Pick<User, 'id' | 'username'> })[]> {
    const response = await api.get<(ListShare & { user: Pick<User, 'id' | 'username'> })[]>(
      `/api/lists/${listId}/shares`,
    );
    return response.data;
  },
  async shareList(
    listId: string,
    payload: { username: string; permission: 'READ' | 'WRITE' | 'ADMIN' },
  ): Promise<ListShare & { user: Pick<User, 'id' | 'username'> }> {
    const response = await api.post<ListShare & { user: Pick<User, 'id' | 'username'> }>(
      `/api/lists/${listId}/shares`,
      payload,
    );
    return response.data;
  },
  async updateShare(
    listId: string,
    userId: string,
    payload: { permission: 'READ' | 'WRITE' | 'ADMIN' },
  ): Promise<ListShare & { user: Pick<User, 'id' | 'username'> }> {
    const response = await api.patch<ListShare & { user: Pick<User, 'id' | 'username'> }>(
      `/api/lists/${listId}/shares/${userId}`,
      payload,
    );
    return response.data;
  },
  async removeShare(listId: string, userId: string): Promise<void> {
    await api.delete(`/api/lists/${listId}/shares/${userId}`);
  },

  // Comments
  async listComments(
    taskId: string,
  ): Promise<(Comment & { user: Pick<User, 'id' | 'username'> })[]> {
    const response = await api.get<(Comment & { user: Pick<User, 'id' | 'username'> })[]>(
      `/api/tasks/${taskId}/comments`,
    );
    return response.data;
  },
  async createComment(
    taskId: string,
    content: string,
  ): Promise<Comment & { user: Pick<User, 'id' | 'username'> }> {
    const response = await api.post<Comment & { user: Pick<User, 'id' | 'username'> }>(
      `/api/tasks/${taskId}/comments`,
      { content },
    );
    return response.data;
  },
  async updateComment(
    commentId: string,
    content: string,
  ): Promise<Comment & { user: Pick<User, 'id' | 'username'> }> {
    const response = await api.patch<Comment & { user: Pick<User, 'id' | 'username'> }>(
      `/api/comments/${commentId}`,
      { content },
    );
    return response.data;
  },
  async deleteComment(commentId: string): Promise<void> {
    await api.delete(`/api/comments/${commentId}`);
  },

  // Activity logs
  async listActivity(params?: {
    taskId?: string;
    listId?: string;
    limit?: number;
  }): Promise<
    (ActivityLog & {
      user: Pick<User, 'id' | 'username'>;
      task: Pick<Task, 'id' | 'title'> | null;
    })[]
  > {
    const response = await api.get<
      (ActivityLog & {
        user: Pick<User, 'id' | 'username'>;
        task: Pick<Task, 'id' | 'title'> | null;
      })[]
    >('/api/activity', { params });
    return response.data;
  },
  async listListActivity(
    listId: string,
  ): Promise<
    (ActivityLog & {
      user: Pick<User, 'id' | 'username'>;
      task: Pick<Task, 'id' | 'title'> | null;
    })[]
  > {
    const response = await api.get<
      (ActivityLog & {
        user: Pick<User, 'id' | 'username'>;
        task: Pick<Task, 'id' | 'title'> | null;
      })[]
    >(`/api/lists/${listId}/activity`);
    return response.data;
  },

  // Task assignments
  async listAssignedTasks(): Promise<Task[]> {
    const response = await api.get<Task[]>('/api/assigned-tasks');
    return response.data;
  },
  async assignTask(taskId: string, username: string): Promise<Task> {
    const response = await api.post<Task>(`/api/tasks/${taskId}/assign`, { username });
    return response.data;
  },
  async unassignTask(taskId: string): Promise<Task> {
    const response = await api.delete<Task>(`/api/tasks/${taskId}/assign`);
    return response.data;
  },
};
