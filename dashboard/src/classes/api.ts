// node_modules
import axios, { type AxiosInstance } from 'axios';

// types
import type {
  AppSettings,
  List,
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
  }> {
    const response = await api.get<{
      ok: boolean;
      needsSetup: boolean;
      registrationEnabled: boolean;
    }>('/api/health');
    return response.data;
  },
};

// -------------------------------------------------- Auth --------------------------------------------------

export const authApi = {
  async register(username: string, password: string): Promise<{ token: string }> {
    const response = await api.post<{ token: string }>('/api/auth/register', { username, password });
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
  }> {
    const response = await api.post<{
      valid: boolean;
      username: string | null;
      userId: string | null;
      isAdmin: boolean;
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
};
