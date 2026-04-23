export type Priority = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
  language: string;
  autoTheme: boolean;
  darkTheme: string | null;
  lightTheme: string | null;
  avatarUrl?: string | null;
}

export interface List {
  id: string;
  userId: string;
  title: string;
  icon: string | null;
  color: string | null;
  category: string | null;
  commentsEnabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
  doneCount?: number;
  activeCount?: number;
  isShared?: boolean;
  sharedPermission?: 'READ' | 'WRITE' | 'ADMIN' | null;
}

export interface Tag {
  id: string;
  userId: string;
  name: string;
  color: string | null;
}

export interface RecurringRule {
  id: string;
  taskId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  interval: number;
  streak: number;
  createdAt: string;
}

export interface Task {
  id: string;
  listId: string;
  userId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  dueDateHasTime: boolean;
  priority: Priority;
  done: boolean;
  doneAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  parentTaskId: string | null;
  subTasks?: Task[];
  tags: Tag[];
  list?: { id: string; title: string };
  recurringRule?: RecurringRule | null;
  reminderOffset?: number | null;
  assignedToUserId?: string | null;
  assignedTo?: Pick<User, 'id' | 'username'> | null;
}

export interface ListShare {
  id: string;
  listId: string;
  userId: string;
  permission: 'READ' | 'WRITE' | 'ADMIN';
  invitedById: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  taskId: string | null;
  listId: string | null;
  action: string;
  details: string | null;
  createdAt: string;
}

export interface UserSettings {
  language: string;
  autoTheme: boolean;
  darkTheme: string | null;
  lightTheme: string | null;
}

export interface AppSettings {
  registrationEnabled: boolean;
  commentsEnabled: boolean;
  aiApiUrl: string | null;
  aiApiKey: string | null;
  aiModel: string | null;
}

export interface AiSuggestion {
  id: string;
  title: string;
}

export interface CalendarFeed {
  id: string;
  name: string | null;
  includeDone: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  listIds: string[];
}

export interface CalendarFeedWithToken extends CalendarFeed {
  token: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ApiKeyWithPlainKey extends ApiKey {
  key: string;
}
