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
}

export interface List {
  id: string;
  userId: string;
  title: string;
  icon: string | null;
  color: string | null;
  category: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
  doneCount?: number;
  activeCount?: number;
}

export interface Tag {
  id: string;
  userId: string;
  name: string;
  color: string | null;
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
}

export interface UserSettings {
  language: string;
  autoTheme: boolean;
  darkTheme: string | null;
  lightTheme: string | null;
}

export interface AppSettings {
  registrationEnabled: boolean;
}
