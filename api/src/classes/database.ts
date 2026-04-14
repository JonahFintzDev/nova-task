// node_modules
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// classes
import { config } from './config';

// generated
import { PrismaClient } from '../generated/client/client';
import type { Prisma } from '../generated/client/client';

// types
import type { Priority } from '../generated/client/enums';

const pool = new Pool({ connectionString: config.database.url });
const adapter = new PrismaPg(pool);
const _prisma = new PrismaClient({ adapter });

// -------------------------------------------------- Users --------------------------------------------------

async function countUsers(): Promise<number> {
  return _prisma.user.count();
}

async function findUserByUsername(username: string) {
  return _prisma.user.findUnique({ where: { username } });
}

async function findUserById(id: string) {
  return _prisma.user.findUnique({ where: { id } });
}

async function createUser(data: {
  username: string;
  passwordHash: string;
  isAdmin?: boolean;
  language?: string;
}) {
  return _prisma.user.create({
    data: {
      id: randomUUID(),
      username: data.username,
      passwordHash: data.passwordHash,
      isAdmin: data.isAdmin ?? false,
      language: data.language ?? 'en',
    },
  });
}

async function updateUser(id: string, data: Prisma.UserUpdateInput) {
  try {
    return await _prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        isAdmin: true,
        createdAt: true,
        language: true,
        autoTheme: true,
        darkTheme: true,
        lightTheme: true,
      },
    });
  } catch {
    return null;
  }
}

async function deleteUser(id: string): Promise<boolean> {
  try {
    await _prisma.user.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

async function listUsers() {
  return _prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      username: true,
      isAdmin: true,
      createdAt: true,
      language: true,
      autoTheme: true,
      darkTheme: true,
      lightTheme: true,
    },
  });
}

// -------------------------------------------------- Lists --------------------------------------------------

async function listLists(userId: string) {
  const lists = await _prisma.list.findMany({
    where: { userId },
    orderBy: { sortOrder: 'asc' },
  });
  const activeTopLevelCounts = await _prisma.task.groupBy({
    by: ['listId'],
    where: {
      userId,
      done: false,
      parentTaskId: null,
    },
    _count: { _all: true },
  });
  const taskStats = await _prisma.task.groupBy({
    by: ['listId', 'done'],
    where: { userId },
    _count: { _all: true },
  });
  const activeTopLevelMap = new Map<string, number>();
  for (const row of activeTopLevelCounts) {
    activeTopLevelMap.set(row.listId, row._count._all);
  }
  const statsMap = new Map<string, { total: number; done: number }>();
  for (const row of taskStats) {
    const key = row.listId;
    if (!statsMap.has(key)) {
      statsMap.set(key, { total: 0, done: 0 });
    }
    const entry = statsMap.get(key)!;
    entry.total += row._count._all;
    if (row.done) {
      entry.done += row._count._all;
    }
  }
  return lists.map((list) => {
    const stats = statsMap.get(list.id) ?? { total: 0, done: 0 };
    return {
      ...list,
      taskCount: stats.total,
      doneCount: stats.done,
      activeCount: activeTopLevelMap.get(list.id) ?? 0,
    };
  });
}

async function findList(id: string, userId: string) {
  return _prisma.list.findFirst({ where: { id, userId } });
}

async function createList(userId: string, data: { title: string; icon?: string; color?: string; category?: string }) {
  const maxOrder = await _prisma.list.aggregate({
    where: { userId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  return _prisma.list.create({
    data: {
      id: randomUUID(),
      userId,
      title: data.title,
      icon: data.icon ?? null,
      color: data.color ?? null,
      category: data.category ?? null,
      sortOrder,
    },
  });
}

async function updateList(id: string, userId: string, data: Prisma.ListUpdateInput) {
  const existing = await findList(id, userId);
  if (!existing) {
    return null;
  }
  return _prisma.list.update({ where: { id }, data });
}

async function deleteList(id: string, userId: string): Promise<boolean> {
  const existing = await findList(id, userId);
  if (!existing) {
    return false;
  }
  await _prisma.list.delete({ where: { id } });
  return true;
}

async function reorderLists(userId: string, items: { id: string; sortOrder: number }[]): Promise<void> {
  await _prisma.$transaction(
    items.map((item) =>
      _prisma.list.updateMany({
        where: { id: item.id, userId },
        data: { sortOrder: item.sortOrder },
      }),
    ),
  );
}

// -------------------------------------------------- Tasks --------------------------------------------------

const taskInclude = {
  tags: { include: { tag: true } },
  subTasks: {
    include: {
      tags: { include: { tag: true } },
      subTasks: {
        include: {
          tags: { include: { tag: true } },
          subTasks: {
            include: { tags: { include: { tag: true } } },
          },
        },
      },
    },
  },
} as const;

function mapTaskToApi(task: unknown): unknown {
  if (!task || typeof task !== 'object') {
    return task;
  }
  const row = task as {
    tags?: { tag: { id: string; userId: string; name: string; color: string | null } }[];
    subTasks?: unknown[];
  };
  return {
    ...(task as Record<string, unknown>),
    tags: (row.tags ?? []).map((tt) => tt.tag),
    subTasks: row.subTasks?.map((st) => mapTaskToApi(st)),
  };
}

async function listTasks(
  userId: string,
  params: {
    listId?: string;
    parentTaskId?: string | null;
    done?: boolean;
    priority?: Priority;
    tagId?: string;
  },
) {
  const where: Prisma.TaskWhereInput = { userId };
  if (params.listId) {
    where.listId = params.listId;
  }
  if (params.parentTaskId !== undefined) {
    where.parentTaskId = params.parentTaskId;
  }
  if (params.done !== undefined) {
    where.done = params.done;
  }
  if (params.priority) {
    where.priority = params.priority;
  }
  if (params.tagId) {
    where.tags = { some: { tagId: params.tagId } };
  }
  const tasks = await _prisma.task.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      tags: { include: { tag: true } },
    },
  });
  return tasks.map((task) => ({
    ...task,
    tags: task.tags.map((tt) => tt.tag),
  }));
}

async function findTask(id: string, userId: string) {
  const task = await _prisma.task.findFirst({
    where: { id, userId },
    include: taskInclude,
  });
  if (!task) {
    return null;
  }
  return mapTaskToApi(task) as Record<string, unknown>;
}

async function createTask(
  userId: string,
  data: {
    listId: string;
    title: string;
    description?: string | null;
    dueDate?: Date | null;
    dueDateHasTime?: boolean;
    priority?: Priority;
    parentTaskId?: string | null;
    tagIds?: string[];
  },
) {
  const normalizedParentTaskId =
    typeof data.parentTaskId === 'string' ? data.parentTaskId.trim() || null : data.parentTaskId ?? null;
  const list = await findList(data.listId, userId);
  if (!list) {
    return null;
  }
  if (normalizedParentTaskId) {
    const parent = await _prisma.task.findFirst({
      where: { id: normalizedParentTaskId, userId },
    });
    if (!parent || parent.parentTaskId !== null || parent.listId !== data.listId) {
      return null;
    }
  }
  const maxOrder = await _prisma.task.aggregate({
    where: {
      listId: data.listId,
      userId,
      parentTaskId: data.parentTaskId ?? null,
    },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  const task = await _prisma.task.create({
    data: {
      id: randomUUID(),
      listId: data.listId,
      userId,
      title: data.title,
      description: data.description ?? null,
      dueDate: data.dueDate ?? null,
      dueDateHasTime: data.dueDateHasTime ?? false,
      priority: data.priority ?? 'NONE',
      parentTaskId: normalizedParentTaskId,
      sortOrder,
      tags:
        data.tagIds && data.tagIds.length > 0
          ? { create: data.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
    },
    include: { tags: { include: { tag: true } } },
  });
  return {
    ...task,
    tags: task.tags.map((tt) => tt.tag),
    subTasks: [],
  };
}

async function updateTask(
  id: string,
  userId: string,
  data: Prisma.TaskUpdateInput & { tagIds?: string[] },
) {
  const existing = await _prisma.task.findFirst({ where: { id, userId } });
  if (!existing) {
    return null;
  }
  const { tagIds, ...rest } = data;
  await _prisma.task.update({
    where: { id },
    data: rest,
  });
  if (tagIds !== undefined) {
    await _prisma.taskTag.deleteMany({ where: { taskId: id } });
    if (tagIds.length > 0) {
      await _prisma.taskTag.createMany({
        data: tagIds.map((tagId) => ({ taskId: id, tagId })),
      });
    }
  }
  return findTask(id, userId);
}

async function deleteTask(id: string, userId: string): Promise<boolean> {
  const existing = await _prisma.task.findFirst({ where: { id, userId } });
  if (!existing) {
    return false;
  }
  await _prisma.task.delete({ where: { id } });
  return true;
}

async function toggleDone(id: string, userId: string) {
  const existing = await _prisma.task.findFirst({ where: { id, userId } });
  if (!existing) {
    return null;
  }
  const done = !existing.done;
  await _prisma.task.update({
    where: { id },
    data: {
      done,
      doneAt: done ? new Date() : null,
    },
  });
  const task = await _prisma.task.findFirst({
    where: { id, userId },
    include: { tags: { include: { tag: true } } },
  });
  if (!task) {
    return null;
  }
  return {
    ...task,
    tags: task.tags.map((tt) => tt.tag),
  };
}

async function reorderTasks(userId: string, items: { id: string; sortOrder: number }[]): Promise<void> {
  await _prisma.$transaction(
    items.map((item) =>
      _prisma.task.updateMany({
        where: { id: item.id, userId },
        data: { sortOrder: item.sortOrder },
      }),
    ),
  );
}

async function deleteDoneTasksInList(listId: string, userId: string): Promise<number> {
  const result = await _prisma.task.deleteMany({
    where: { listId, userId, done: true },
  });
  return result.count;
}

// -------------------------------------------------- Tags --------------------------------------------------

async function listTags(userId: string) {
  return _prisma.tag.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  });
}

async function createTag(userId: string, data: { name: string; color?: string | null }) {
  return _prisma.tag.create({
    data: {
      id: randomUUID(),
      userId,
      name: data.name.trim(),
      color: data.color ?? null,
    },
  });
}

async function updateTag(id: string, userId: string, data: { name?: string; color?: string | null }) {
  const existing = await _prisma.tag.findFirst({ where: { id, userId } });
  if (!existing) {
    return null;
  }
  return _prisma.tag.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
    },
  });
}

async function deleteTag(id: string, userId: string): Promise<boolean> {
  const existing = await _prisma.tag.findFirst({ where: { id, userId } });
  if (!existing) {
    return false;
  }
  await _prisma.tag.delete({ where: { id } });
  return true;
}

// -------------------------------------------------- Search --------------------------------------------------

async function searchTasksAndLists(
  userId: string,
  query: string,
  filters: { listId?: string; done?: boolean; priority?: Priority; tagId?: string },
) {
  const term = query.trim();
  if (term === '') {
    return { lists: [], tasks: [] as unknown[] };
  }
  const lists = await _prisma.list.findMany({
    where: {
      userId,
      title: { contains: term, mode: 'insensitive' },
    },
    orderBy: { sortOrder: 'asc' },
  });
  const taskWhere: Prisma.TaskWhereInput = {
    userId,
    OR: [
      { title: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } },
    ],
  };
  if (filters.listId) {
    taskWhere.listId = filters.listId;
  }
  if (filters.done !== undefined) {
    taskWhere.done = filters.done;
  }
  if (filters.priority) {
    taskWhere.priority = filters.priority;
  }
  if (filters.tagId) {
    taskWhere.tags = { some: { tagId: filters.tagId } };
  }
  const tasks = await _prisma.task.findMany({
    where: taskWhere,
    orderBy: [{ listId: 'asc' }, { sortOrder: 'asc' }],
    include: {
      tags: { include: { tag: true } },
      list: { select: { id: true, title: true } },
    },
    take: 100,
  });
  return {
    lists,
    tasks: tasks.map((task) => ({
      ...task,
      tags: task.tags.map((tt) => tt.tag),
    })),
  };
}

// -------------------------------------------------- Settings --------------------------------------------------

async function getUserSettings(userId: string) {
  const user = await findUserById(userId);
  if (!user) {
    return null;
  }
  return {
    language: user.language,
    autoTheme: user.autoTheme,
    darkTheme: user.darkTheme,
    lightTheme: user.lightTheme,
  };
}

async function updateUserSettings(
  userId: string,
  data: {
    language?: string;
    autoTheme?: boolean;
    darkTheme?: string | null;
    lightTheme?: string | null;
  },
) {
  return _prisma.user.update({
    where: { id: userId },
    data,
    select: {
      language: true,
      autoTheme: true,
      darkTheme: true,
      lightTheme: true,
    },
  });
}

async function getAppSettings(): Promise<{ registrationEnabled: boolean }> {
  const row = await _prisma.appSettings.findUnique({ where: { key: 'registrationEnabled' } });
  const value = row?.value ?? 'true';
  return { registrationEnabled: value === 'true' };
}

async function updateAppSettings(data: { registrationEnabled?: boolean }): Promise<void> {
  if (data.registrationEnabled !== undefined) {
    await _prisma.appSettings.upsert({
      where: { key: 'registrationEnabled' },
      create: { key: 'registrationEnabled', value: data.registrationEnabled ? 'true' : 'false' },
      update: { value: data.registrationEnabled ? 'true' : 'false' },
    });
  }
}

// -------------------------------------------------- Export --------------------------------------------------

export const db = {
  countUsers,
  findUserByUsername,
  findUserById,
  createUser,
  updateUser,
  deleteUser,
  listUsers,
  listLists,
  findList,
  createList,
  updateList,
  deleteList,
  reorderLists,
  listTasks,
  findTask,
  createTask,
  updateTask,
  deleteTask,
  toggleDone,
  reorderTasks,
  deleteDoneTasksInList,
  listTags,
  createTag,
  updateTag,
  deleteTag,
  searchTasksAndLists,
  getUserSettings,
  updateUserSettings,
  getAppSettings,
  updateAppSettings,
};
