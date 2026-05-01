// node_modules
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// classes
import { config } from "./config";

// generated
import { PrismaClient } from "../generated/client/client";
import type { Prisma } from "../generated/client/client";

// types
import type { Priority } from "../generated/client/enums";

// -------------------------------------------------- Recurring helpers --------------------------------------------------

function calculateNextDue(
  currentDue: Date | null,
  frequency: string,
  interval: number,
): Date | null {
  if (!currentDue) return null;
  const base = new Date(currentDue);
  switch (frequency) {
    case "daily":
      base.setDate(base.getDate() + interval);
      break;
    case "weekly":
      base.setDate(base.getDate() + 7 * interval);
      break;
    case "monthly":
      base.setMonth(base.getMonth() + interval);
      break;
    case "quarterly":
      base.setMonth(base.getMonth() + 3 * interval);
      break;
    case "yearly":
      base.setFullYear(base.getFullYear() + interval);
      break;
  }
  return base;
}

const pool = new Pool({ connectionString: config.database.url });
const adapter = new PrismaPg(pool);
const _prisma = new PrismaClient({ adapter });

type ListAccess = {
  listId: string;
  isOwner: boolean;
  permission: "READ" | "WRITE" | "ADMIN" | null;
};

async function getListAccess(
  listId: string,
  userId: string,
): Promise<ListAccess | null> {
  const ownList = await _prisma.list.findFirst({
    where: { id: listId, userId },
    select: { id: true },
  });
  if (ownList) {
    return { listId, isOwner: true, permission: "ADMIN" };
  }
  const share = await _prisma.listShare.findUnique({
    where: { listId_userId: { listId, userId } },
    select: { permission: true },
  });
  if (!share) {
    return null;
  }
  return { listId, isOwner: false, permission: share.permission };
}

function hasWriteAccess(access: ListAccess | null): boolean {
  return (
    access !== null &&
    (access.isOwner ||
      access.permission === "WRITE" ||
      access.permission === "ADMIN")
  );
}

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
      language: data.language ?? "en",
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
        avatarExt: true,
        aiFeaturesDisabled: true,
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
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      isAdmin: true,
      createdAt: true,
      language: true,
      autoTheme: true,
      darkTheme: true,
      lightTheme: true,
      avatarExt: true,
      aiFeaturesDisabled: true,
    },
  });
}

// -------------------------------------------------- Lists --------------------------------------------------

async function listLists(userId: string) {
  // Get user's own lists
  const ownLists = await _prisma.list.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
  });
  // Get shared lists
  const sharedListShares = await _prisma.listShare.findMany({
    where: { userId },
    include: { list: true },
  });
  const sharedLists = sharedListShares.map((share) => ({
    ...share.list,
    isShared: true,
    sharedPermission: share.permission,
  }));
  const allLists = [
    ...ownLists.map((l) => ({ ...l, isShared: false })),
    ...sharedLists,
  ];
  const sharedListIds = sharedListShares.map((s) => s.listId);
  const taskWhere: Prisma.TaskWhereInput =
    sharedListIds.length > 0
      ? { OR: [{ userId }, { listId: { in: sharedListIds } }] }
      : { userId };
  const activeTopLevelCounts = await _prisma.task.groupBy({
    by: ["listId"],
    where: {
      ...taskWhere,
      done: false,
      parentTaskId: null,
    },
    _count: { _all: true },
  });
  const taskStats = await _prisma.task.groupBy({
    by: ["listId", "done"],
    where: taskWhere,
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
  return allLists.map((list: { id: string }) => {
    const stats = statsMap.get(list.id) ?? { total: 0, done: 0 };
    return {
      ...list,
      taskCount: stats.total,
      doneCount: stats.done,
      activeCount: activeTopLevelMap.get(list.id) ?? 0,
    };
  });
}

async function findList(id: string, userId: string, includeShared = false) {
  // First try to find as owner
  const ownList = await _prisma.list.findFirst({ where: { id, userId } });
  if (ownList) {
    return { ...ownList, isShared: false, sharedPermission: null };
  }
  // If not found and includeShared is true, check for shared access
  if (includeShared) {
    const share = await _prisma.listShare.findUnique({
      where: { listId_userId: { listId: id, userId } },
      include: { list: true },
    });
    if (share) {
      return {
        ...share.list,
        isShared: true,
        sharedPermission: share.permission,
      };
    }
  }
  return null;
}

async function createList(
  userId: string,
  data: {
    title: string;
    icon?: string;
    color?: string;
    category?: string;
    commentsEnabled?: boolean;
  },
) {
  const maxOrder = await _prisma.list.aggregate({
    where: { userId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  const list = await _prisma.list.create({
    data: {
      id: randomUUID(),
      userId,
      title: data.title,
      icon: data.icon ?? null,
      color: data.color ?? null,
      category: data.category ?? null,
      ...(data.commentsEnabled !== undefined
        ? { ["commentsEnabled"]: data.commentsEnabled }
        : {}),
      sortOrder,
    },
  });
  await logActivity(userId, {
    action: "LIST_CREATED",
    listId: list.id,
    details: `Created list "${list.title}"`,
  });
  return list;
}

async function updateList(
  id: string,
  userId: string,
  data: Prisma.ListUpdateInput,
) {
  const existing = await findList(id, userId);
  if (!existing) {
    return null;
  }
  const updated = await _prisma.list.update({ where: { id }, data });
  await logActivity(userId, {
    action: "LIST_UPDATED",
    listId: id,
    details: `Updated list "${updated.title}"`,
  });
  return updated;
}

async function deleteList(id: string, userId: string): Promise<boolean> {
  const existing = await findList(id, userId);
  if (!existing) {
    return false;
  }
  await _prisma.list.delete({ where: { id } });
  await logActivity(userId, {
    action: "LIST_DELETED",
    details: `Deleted list "${existing.title}"`,
  });
  return true;
}

async function reorderLists(
  userId: string,
  items: { id: string; sortOrder: number }[],
): Promise<void> {
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
  recurringRule: true,
  subTasks: {
    include: {
      tags: { include: { tag: true } },
      recurringRule: true,
      subTasks: {
        include: {
          tags: { include: { tag: true } },
          recurringRule: true,
          subTasks: {
            include: { tags: { include: { tag: true } }, recurringRule: true },
          },
        },
      },
    },
  },
} as const;

function mapTaskToApi(task: unknown): unknown {
  if (!task || typeof task !== "object") {
    return task;
  }
  const row = task as {
    tags?: {
      tag: { id: string; userId: string; name: string; color: string | null };
    }[];
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
    includeShared?: boolean;
  },
) {
  // Find all shared list IDs
  const sharedListIds: string[] = [];
  if (params.includeShared !== false) {
    const shares = await _prisma.listShare.findMany({
      where: { userId },
      select: { listId: true },
    });
    sharedListIds.push(...shares.map((s) => s.listId));
  }
  const access: Prisma.TaskWhereInput =
    sharedListIds.length > 0
      ? { OR: [{ userId }, { listId: { in: sharedListIds } }] }
      : { userId };

  const filters: Prisma.TaskWhereInput[] = [access];
  if (params.listId) {
    filters.push({ listId: params.listId });
  }
  if (params.parentTaskId !== undefined) {
    filters.push({ parentTaskId: params.parentTaskId });
  }
  if (params.done !== undefined) {
    filters.push({ done: params.done });
  }
  if (params.priority) {
    filters.push({ priority: params.priority });
  }
  if (params.tagId) {
    filters.push({ tags: { some: { tagId: params.tagId } } });
  }

  const where: Prisma.TaskWhereInput =
    filters.length === 1 ? filters[0]! : { AND: filters };
  const tasks = await _prisma.task.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      tags: { include: { tag: true } },
    },
  });
  return tasks.map((task) => ({
    ...task,
    tags: task.tags.map((tt) => tt.tag),
  }));
}

async function findTask(id: string, userId: string, includeShared = false) {
  // First try to find as owner
  const task = await _prisma.task.findFirst({
    where: { id, userId },
    include: taskInclude,
  });
  if (task) {
    return mapTaskToApi(task) as Record<string, unknown>;
  }
  // If not found and includeShared is true, check for shared list access
  if (includeShared) {
    const sharedTask = await _prisma.task.findFirst({
      where: { id, list: { shares: { some: { userId } } } },
      include: taskInclude,
    });
    if (sharedTask) {
      return mapTaskToApi(sharedTask) as Record<string, unknown>;
    }
  }
  return null;
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
    reminderOffset?: number | null;
  },
) {
  const normalizedParentTaskId =
    typeof data.parentTaskId === "string"
      ? data.parentTaskId.trim() || null
      : (data.parentTaskId ?? null);
  const listAccess = await getListAccess(data.listId, userId);
  if (!hasWriteAccess(listAccess)) {
    return null;
  }
  if (normalizedParentTaskId) {
    const parent = await _prisma.task.findFirst({
      where: { id: normalizedParentTaskId, listId: data.listId },
    });
    if (
      !parent ||
      parent.parentTaskId !== null ||
      parent.listId !== data.listId
    ) {
      return null;
    }
  }
  const maxOrder = await _prisma.task.aggregate({
    where: {
      listId: data.listId,
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
      priority: data.priority ?? "NONE",
      parentTaskId: normalizedParentTaskId,
      reminderOffset: data.reminderOffset ?? null,
      sortOrder,
      tags:
        data.tagIds && data.tagIds.length > 0
          ? { create: data.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
    },
    include: { tags: { include: { tag: true } } },
  });
  const result = {
    ...task,
    tags: task.tags.map((tt) => tt.tag),
    subTasks: [],
  };
  await logActivity(userId, {
    action: "TASK_CREATED",
    taskId: task.id,
    listId: task.listId,
    details: `Created task "${task.title}"`,
  });
  return result;
}

async function updateTask(
  id: string,
  userId: string,
  data: Prisma.TaskUpdateInput & { tagIds?: string[] },
) {
  const existing = await _prisma.task.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }
  const listAccess = await getListAccess(existing.listId, userId);
  if (!hasWriteAccess(listAccess)) {
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
  // Log activity for significant changes
  const action =
    data.done !== undefined
      ? data.done
        ? "TASK_COMPLETED"
        : "TASK_REOPENED"
      : "TASK_UPDATED";
  await logActivity(userId, {
    action,
    taskId: id,
    listId: existing.listId,
    details:
      action === "TASK_COMPLETED"
        ? `Completed task "${existing.title}"`
        : action === "TASK_REOPENED"
          ? `Reopened task "${existing.title}"`
          : `Updated task "${existing.title}"`,
  });
  return findTask(id, userId, true);
}

async function deleteTask(id: string, userId: string): Promise<boolean> {
  const existing = await _prisma.task.findUnique({ where: { id } });
  if (!existing) {
    return false;
  }
  const listAccess = await getListAccess(existing.listId, userId);
  if (!hasWriteAccess(listAccess)) {
    return false;
  }
  await _prisma.task.delete({ where: { id } });
  await logActivity(userId, {
    action: "TASK_DELETED",
    listId: existing.listId,
    details: `Deleted task "${existing.title}"`,
  });
  return true;
}

async function toggleDone(id: string, userId: string) {
  const existing = await _prisma.task.findUnique({
    where: { id },
    include: {
      recurringRule: true,
      tags: { include: { tag: true } },
    },
  });
  if (!existing) {
    return null;
  }
  const listAccess = await getListAccess(existing.listId, userId);
  if (!hasWriteAccess(listAccess)) {
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

  // When completing a recurring task, create the next occurrence
  if (done && existing.recurringRule) {
    const rule = existing.recurringRule;
    const nextDue = calculateNextDue(
      existing.dueDate,
      rule.frequency,
      rule.interval,
    );
    const tagIds = existing.tags.map((tt) => tt.tag.id);
    const newTask = await createTask(userId, {
      listId: existing.listId,
      title: existing.title,
      description: existing.description ?? undefined,
      dueDate: nextDue ?? undefined,
      dueDateHasTime: nextDue ? existing.dueDateHasTime : false,
      priority: existing.priority,
      tagIds,
      reminderOffset: existing.reminderOffset,
    });
    if (newTask) {
      await _prisma.recurringRule.create({
        data: {
          id: randomUUID(),
          taskId: newTask.id,
          userId,
          frequency: rule.frequency,
          interval: rule.interval,
          streak: rule.streak + 1,
        },
      });
    }
  }

  // Log activity for task completion/reopen
  await logActivity(userId, {
    action: done ? "TASK_COMPLETED" : "TASK_REOPENED",
    taskId: id,
    listId: existing.listId,
    details: done
      ? `Completed task "${existing.title}"`
      : `Reopened task "${existing.title}"`,
  });

  const task = await _prisma.task.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      recurringRule: true,
    },
  });
  if (!task) {
    return null;
  }
  return {
    ...task,
    tags: task.tags.map((tt) => tt.tag),
  };
}

async function reorderTasks(
  userId: string,
  items: { id: string; sortOrder: number }[],
): Promise<void> {
  const ownLists = await _prisma.list.findMany({
    where: { userId },
    select: { id: true },
  });
  const writableShares = await _prisma.listShare.findMany({
    where: { userId, permission: { in: ["WRITE", "ADMIN"] } },
    select: { listId: true },
  });
  const writableListIds = [
    ...ownLists.map((row) => row.id),
    ...writableShares.map((row) => row.listId),
  ];
  await _prisma.$transaction(
    items.map((item) =>
      _prisma.task.updateMany({
        where: {
          id: item.id,
          listId: { in: writableListIds },
        },
        data: { sortOrder: item.sortOrder },
      }),
    ),
  );
}

async function deleteDoneTasksInList(
  listId: string,
  userId: string,
): Promise<number> {
  const listAccess = await getListAccess(listId, userId);
  if (!hasWriteAccess(listAccess)) {
    return 0;
  }
  const result = await _prisma.task.deleteMany({
    where: { listId, done: true },
  });
  return result.count;
}

// -------------------------------------------------- Tags --------------------------------------------------

async function listTags(userId: string) {
  return _prisma.tag.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
}

async function createTag(
  userId: string,
  data: { name: string; color?: string | null },
) {
  return _prisma.tag.create({
    data: {
      id: randomUUID(),
      userId,
      name: data.name.trim(),
      color: data.color ?? null,
    },
  });
}

async function updateTag(
  id: string,
  userId: string,
  data: { name?: string; color?: string | null },
) {
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
  filters: {
    listId?: string;
    done?: boolean;
    priority?: Priority;
    tagId?: string;
  },
) {
  const term = query.trim();
  if (term === "") {
    return { lists: [], tasks: [] as unknown[] };
  }
  const lists = await _prisma.list.findMany({
    where: {
      userId,
      title: { contains: term, mode: "insensitive" },
    },
    orderBy: { sortOrder: "asc" },
  });
  const taskWhere: Prisma.TaskWhereInput = {
    userId,
    OR: [
      { title: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
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
    orderBy: [{ listId: "asc" }, { sortOrder: "asc" }],
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

// -------------------------------------------------- Push Subscriptions --------------------------------------------------

async function upsertPushSubscription(data: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  const id = randomUUID();
  await _prisma.pushSubscription.upsert({
    where: { endpoint: data.endpoint },
    create: {
      id,
      userId: data.userId,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth: data.auth,
    },
    update: {
      userId: data.userId,
      p256dh: data.p256dh,
      auth: data.auth,
    },
  });
}

async function deletePushSubscriptionByEndpoint(
  endpoint: string,
): Promise<void> {
  await _prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

async function listPushSubscriptions() {
  return _prisma.pushSubscription.findMany();
}

async function listPushSubscriptionsByUser(userId: string) {
  return _prisma.pushSubscription.findMany({ where: { userId } });
}

// -------------------------------------------------- Recurring Rules --------------------------------------------------

async function getRecurringRule(taskId: string, userId: string) {
  return _prisma.recurringRule.findFirst({ where: { taskId, userId } });
}

async function setRecurringRule(
  taskId: string,
  userId: string,
  data: { frequency: string; interval: number },
) {
  return _prisma.recurringRule.upsert({
    where: { taskId },
    create: {
      id: randomUUID(),
      taskId,
      userId,
      frequency: data.frequency,
      interval: data.interval,
      streak: 0,
    },
    update: {
      frequency: data.frequency,
      interval: data.interval,
    },
  });
}

async function deleteRecurringRule(
  taskId: string,
  userId: string,
): Promise<boolean> {
  const existing = await _prisma.recurringRule.findFirst({
    where: { taskId, userId },
  });
  if (!existing) return false;
  await _prisma.recurringRule.delete({ where: { taskId } });
  return true;
}

// -------------------------------------------------- Reminders --------------------------------------------------

async function findTasksDueForReminder(now: Date) {
  // Fetch all tasks with a reminder offset configured that haven't been notified yet.
  // We filter per-task in JS since each row has its own offset.
  const tasks = await _prisma.task.findMany({
    where: {
      done: false,
      parentTaskId: null,
      reminderSentAt: null,
      reminderOffset: { not: null },
      dueDate: { not: null },
    },
    select: {
      id: true,
      userId: true,
      title: true,
      dueDate: true,
      reminderOffset: true,
    },
  });
  return tasks.filter((task) => {
    const notifyAt = new Date(
      task.dueDate!.getTime() - task.reminderOffset! * 60 * 1000,
    );
    return notifyAt <= now;
  });
}

async function setTaskReminderSent(taskId: string, at: Date): Promise<void> {
  await _prisma.task.update({
    where: { id: taskId },
    data: { reminderSentAt: at },
  });
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
    aiFeaturesDisabled: user.aiFeaturesDisabled,
  };
}

async function updateUserSettings(
  userId: string,
  data: {
    language?: string;
    autoTheme?: boolean;
    darkTheme?: string | null;
    lightTheme?: string | null;
    aiFeaturesDisabled?: boolean;
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
      aiFeaturesDisabled: true,
    },
  });
}

async function getAppSettings(): Promise<{
  registrationEnabled: boolean;
  commentsEnabled: boolean;
  aiApiUrl: string | null;
  aiApiKey: string | null;
  aiModel: string | null;
}> {
  const rows = await _prisma.appSettings.findMany({
    where: {
      key: {
        in: [
          "registrationEnabled",
          "commentsEnabled",
          "aiApiUrl",
          "aiApiKey",
          "aiModel",
        ],
      },
    },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    registrationEnabled: (map.get("registrationEnabled") ?? "true") === "true",
    commentsEnabled: (map.get("commentsEnabled") ?? "true") === "true",
    aiApiUrl: map.get("aiApiUrl") ?? null,
    aiApiKey: map.get("aiApiKey") ?? null,
    aiModel: map.get("aiModel") ?? null,
  };
}

async function updateAppSettings(data: {
  registrationEnabled?: boolean;
  commentsEnabled?: boolean;
  aiApiUrl?: string | null;
  aiApiKey?: string | null;
  aiModel?: string | null;
}): Promise<void> {
  const booleanKeys = [
    ["registrationEnabled", data.registrationEnabled],
    ["commentsEnabled", data.commentsEnabled],
  ] as const;

  for (const [key, val] of booleanKeys) {
    if (val !== undefined) {
      await _prisma.appSettings.upsert({
        where: { key },
        create: { key, value: val ? "true" : "false" },
        update: { value: val ? "true" : "false" },
      });
    }
  }

  const stringKeys = [
    ["aiApiUrl", data.aiApiUrl],
    ["aiApiKey", data.aiApiKey],
    ["aiModel", data.aiModel],
  ] as const;

  for (const [key, val] of stringKeys) {
    if (val !== undefined) {
      if (val === null) {
        await _prisma.appSettings.deleteMany({ where: { key } });
      } else {
        await _prisma.appSettings.upsert({
          where: { key },
          create: { key, value: val },
          update: { value: val },
        });
      }
    }
  }
}

// -------------------------------------------------- List Sharing --------------------------------------------------

async function listListShares(listId: string, ownerId: string) {
  const list = await _prisma.list.findFirst({
    where: { id: listId, userId: ownerId },
  });
  if (!list) {
    return null;
  }
  return _prisma.listShare.findMany({
    where: { listId },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { createdAt: "asc" },
  });
}

async function findListShare(listId: string, userId: string) {
  return _prisma.listShare.findUnique({
    where: { listId_userId: { listId, userId } },
    include: { list: true },
  });
}

async function shareList(
  listId: string,
  ownerId: string,
  data: { username: string; permission: "READ" | "WRITE" | "ADMIN" },
) {
  const list = await _prisma.list.findFirst({
    where: { id: listId, userId: ownerId },
  });
  if (!list) {
    return { success: false, error: "List not found" as const };
  }
  const targetUser = await _prisma.user.findUnique({
    where: { username: data.username },
  });
  if (!targetUser) {
    return { success: false, error: "User not found" as const };
  }
  if (targetUser.id === ownerId) {
    return { success: false, error: "Cannot share with yourself" as const };
  }
  const existing = await _prisma.listShare.findUnique({
    where: { listId_userId: { listId, userId: targetUser.id } },
  });
  if (existing) {
    return { success: false, error: "Already shared with this user" as const };
  }
  const share = await _prisma.listShare.create({
    data: {
      id: randomUUID(),
      listId,
      userId: targetUser.id,
      permission: data.permission,
      invitedById: ownerId,
    },
    include: { user: { select: { id: true, username: true } } },
  });
  return { success: true, share };
}

async function updateListShare(
  listId: string,
  ownerId: string,
  targetUserId: string,
  data: { permission: "READ" | "WRITE" | "ADMIN" },
) {
  const list = await _prisma.list.findFirst({
    where: { id: listId, userId: ownerId },
  });
  if (!list) {
    return null;
  }
  try {
    return await _prisma.listShare.update({
      where: { listId_userId: { listId, userId: targetUserId } },
      data: { permission: data.permission },
      include: { user: { select: { id: true, username: true } } },
    });
  } catch {
    return null;
  }
}

async function removeListShare(
  listId: string,
  ownerId: string,
  targetUserId: string,
): Promise<boolean> {
  const list = await _prisma.list.findFirst({
    where: { id: listId, userId: ownerId },
  });
  if (!list) {
    return false;
  }
  try {
    await _prisma.listShare.delete({
      where: { listId_userId: { listId, userId: targetUserId } },
    });
    return true;
  } catch {
    return false;
  }
}

async function listSharedLists(userId: string) {
  return _prisma.listShare.findMany({
    where: { userId },
    include: {
      list: {
        include: {
          user: { select: { id: true, username: true } },
          _count: { select: { tasks: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

// -------------------------------------------------- Comments --------------------------------------------------

async function listComments(taskId: string, userId: string) {
  // First find the task by id only
  const task = await _prisma.task.findFirst({
    where: { id: taskId },
  });
  if (!task) {
    return null;
  }
  // Check if user owns the task or has access through shared list
  if (task.userId !== userId) {
    const share = await _prisma.listShare.findFirst({
      where: { listId: task.listId, userId },
    });
    if (!share) {
      return null;
    }
  }
  return _prisma.comment.findMany({
    where: { taskId },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { createdAt: "asc" },
  });
}

async function createComment(
  userId: string,
  data: { taskId: string; content: string },
) {
  const task = await _prisma.task.findFirst({
    where: { id: data.taskId },
  });
  if (!task) {
    return null;
  }
  // Check if user owns the task or has write access through shared list
  if (task.userId !== userId) {
    const share = await _prisma.listShare.findFirst({
      where: {
        listId: task.listId,
        userId,
        permission: { in: ["WRITE", "ADMIN"] },
      },
    });
    if (!share) {
      return null;
    }
  }
  const comment = await _prisma.comment.create({
    data: {
      id: randomUUID(),
      taskId: data.taskId,
      userId,
      content: data.content,
    },
    include: { user: { select: { id: true, username: true } } },
  });
  await logActivity(userId, {
    action: "COMMENT_CREATED",
    taskId: data.taskId,
    listId: task.listId,
    details: `Added comment to task "${task.title}"`,
  });
  return comment;
}

async function updateComment(
  commentId: string,
  userId: string,
  data: { content: string },
) {
  const comment = await _prisma.comment.findFirst({
    where: { id: commentId, userId },
  });
  if (!comment) {
    return null;
  }
  return _prisma.comment.update({
    where: { id: commentId },
    data: { content: data.content },
    include: { user: { select: { id: true, username: true } } },
  });
}

async function checkTaskCommentsAvailability(
  taskId: string,
  userId: string,
): Promise<"ENABLED" | "DISABLED" | "NO_ACCESS"> {
  const task = await _prisma.task.findUnique({
    where: { id: taskId },
    include: { list: true },
  });
  if (!task) {
    return "NO_ACCESS";
  }
  if (task.userId !== userId) {
    const share = await _prisma.listShare.findFirst({
      where: { listId: task.listId, userId },
      select: { id: true },
    });
    if (!share) {
      return "NO_ACCESS";
    }
  }
  const listWithComments = task.list as { commentsEnabled?: boolean };
  if (listWithComments.commentsEnabled === false) {
    return "DISABLED";
  }
  return "ENABLED";
}

async function checkCommentCommentsAvailability(
  commentId: string,
  userId: string,
): Promise<"ENABLED" | "DISABLED" | "NO_ACCESS"> {
  const comment = await _prisma.comment.findUnique({
    where: { id: commentId },
    include: { task: { include: { list: true } } },
  });
  if (!comment) {
    return "NO_ACCESS";
  }
  if (comment.task.userId !== userId) {
    const share = await _prisma.listShare.findFirst({
      where: { listId: comment.task.listId, userId },
      select: { id: true },
    });
    if (!share) {
      return "NO_ACCESS";
    }
  }
  const listWithComments = comment.task.list as { commentsEnabled?: boolean };
  if (listWithComments.commentsEnabled === false) {
    return "DISABLED";
  }
  return "ENABLED";
}

async function deleteComment(
  commentId: string,
  userId: string,
): Promise<boolean> {
  const comment = await _prisma.comment.findFirst({
    where: { id: commentId, userId },
  });
  if (!comment) {
    return false;
  }
  await _prisma.comment.delete({ where: { id: commentId } });
  return true;
}

// -------------------------------------------------- Activity Log --------------------------------------------------

async function logActivity(
  userId: string,
  data: {
    action: string;
    taskId?: string;
    listId?: string;
    details?: string;
  },
) {
  return _prisma.activityLog.create({
    data: {
      id: randomUUID(),
      userId,
      taskId: data.taskId ?? null,
      listId: data.listId ?? null,
      action: data.action,
      details: data.details ?? null,
    },
  });
}

async function listActivityLogs(
  userId: string,
  params: { taskId?: string; listId?: string; limit?: number },
) {
  const where: Prisma.ActivityLogWhereInput = { userId };
  if (params.taskId) {
    where.taskId = params.taskId;
  }
  if (params.listId) {
    where.listId = params.listId;
  }
  return _prisma.activityLog.findMany({
    where,
    include: {
      user: { select: { id: true, username: true } },
      task: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 50,
  });
}

async function listActivityLogsForList(listId: string, userId: string) {
  // Verify user has access to the list
  const list = await _prisma.list.findFirst({
    where: { id: listId, userId },
  });
  const share = !list
    ? await _prisma.listShare.findFirst({
        where: { listId, userId },
      })
    : null;
  if (!list && !share) {
    return null;
  }
  return _prisma.activityLog.findMany({
    where: { listId },
    include: {
      user: { select: { id: true, username: true } },
      task: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

// -------------------------------------------------- Task Assignments --------------------------------------------------

async function assignTask(
  taskId: string,
  actorId: string,
  assigneeUsername: string,
) {
  const task = await _prisma.task.findUnique({
    where: { id: taskId },
    include: { list: true },
  });
  if (!task) {
    return { success: false, error: "Task not found" as const };
  }
  const listAccess = await getListAccess(task.listId, actorId);
  if (!hasWriteAccess(listAccess)) {
    return { success: false, error: "Task not found" as const };
  }
  const assignee = await _prisma.user.findUnique({
    where: { username: assigneeUsername },
  });
  if (!assignee) {
    return { success: false, error: "User not found" as const };
  }
  // Check if assignee has access to the list through sharing
  const share = await _prisma.listShare.findFirst({
    where: { listId: task.listId, userId: assignee.id },
  });
  if (!share && task.list.userId !== assignee.id) {
    return {
      success: false,
      error: "User does not have access to this list" as const,
    };
  }
  const updated = await _prisma.task.update({
    where: { id: taskId },
    data: { assignedToUserId: assignee.id },
    include: {
      assignedTo: { select: { id: true, username: true } },
      tags: { include: { tag: true } },
    },
  });
  await logActivity(actorId, {
    action: "TASK_ASSIGNED",
    taskId,
    listId: task.listId,
    details: `Assigned task "${task.title}" to ${assignee.username}`,
  });
  return {
    success: true,
    task: { ...updated, tags: updated.tags.map((tt) => tt.tag) },
  };
}

async function unassignTask(taskId: string, actorId: string) {
  const task = await _prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return null;
  }
  const listAccess = await getListAccess(task.listId, actorId);
  if (!hasWriteAccess(listAccess)) {
    return null;
  }
  const updated = await _prisma.task.update({
    where: { id: taskId },
    data: { assignedToUserId: null },
    include: {
      assignedTo: { select: { id: true, username: true } },
      tags: { include: { tag: true } },
    },
  });
  await logActivity(actorId, {
    action: "TASK_UNASSIGNED",
    taskId,
    listId: task.listId,
    details: `Unassigned task "${task.title}"`,
  });
  return { ...updated, tags: updated.tags.map((tt) => tt.tag) };
}

async function listAssignedTasks(userId: string) {
  return _prisma.task.findMany({
    where: { assignedToUserId: userId },
    include: {
      list: { select: { id: true, title: true } },
      user: { select: { id: true, username: true } },
      tags: { include: { tag: true } },
      recurringRule: true,
    },
    orderBy: [{ done: "asc" }, { dueDate: "asc" }],
  });
}

// -------------------------------------------------- Calendar feeds --------------------------------------------------

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function createCalendarTokenSecret(): string {
  return randomBytes(32).toString("hex");
}

async function listCalendarFeeds(userId: string) {
  return _prisma.calendarFeedToken.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      includeDone: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
      updatedAt: true,
      lists: {
        select: { listId: true },
        orderBy: { listId: "asc" },
      },
    },
  }).then((rows) =>
    rows.map((row) => ({
      ...row,
      listIds: row.lists.map((item) => item.listId),
    })),
  );
}

async function listAccessibleListIds(userId: string): Promise<string[]> {
  const ownLists = await _prisma.list.findMany({
    where: { userId },
    select: { id: true },
  });
  const sharedLists = await _prisma.listShare.findMany({
    where: { userId },
    select: { listId: true },
  });
  return [
    ...ownLists.map((item) => item.id),
    ...sharedLists.map((item) => item.listId),
  ];
}

async function createCalendarFeed(
  userId: string,
  data: {
    name?: string | null;
    includeDone?: boolean;
    expiresAt?: Date | null;
    listIds?: string[];
  },
) {
  const allowedListIds = new Set(await listAccessibleListIds(userId));
  const selectedListIds =
    data.listIds && data.listIds.length > 0
      ? data.listIds.filter((listId) => allowedListIds.has(listId))
      : Array.from(allowedListIds);
  const token = createCalendarTokenSecret();
  const tokenHash = sha256Hex(token);
  const feed = await _prisma.calendarFeedToken.create({
    data: {
      userId,
      name: data.name?.trim() || null,
      includeDone: data.includeDone ?? false,
      expiresAt: data.expiresAt ?? null,
      tokenHash,
      isActive: true,
      lists:
        selectedListIds.length > 0
          ? { createMany: { data: selectedListIds.map((listId) => ({ listId })) } }
          : undefined,
    },
    select: {
      id: true,
      name: true,
      includeDone: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
      updatedAt: true,
      lists: {
        select: { listId: true },
        orderBy: { listId: "asc" },
      },
    },
  });
  return {
    ...feed,
    token,
    listIds: feed.lists.map((item) => item.listId),
  };
}

async function revokeCalendarFeed(id: string, userId: string): Promise<boolean> {
  const result = await _prisma.calendarFeedToken.deleteMany({
    where: { id, userId },
  });
  return result.count === 1;
}

async function updateCalendarFeed(
  id: string,
  userId: string,
  data: {
    name?: string | null;
    includeDone?: boolean;
    listIds?: string[];
  },
) {
  const existing = await _prisma.calendarFeedToken.findFirst({
    where: { id, userId, isActive: true },
    select: { id: true },
  });
  if (!existing) {
    return null;
  }
  const allowedListIds = new Set(await listAccessibleListIds(userId));
  const selectedListIds =
    data.listIds !== undefined
      ? data.listIds.filter((listId) => allowedListIds.has(listId))
      : undefined;
  await _prisma.$transaction(async (tx) => {
    await tx.calendarFeedToken.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name?.trim() || null } : {}),
        ...(data.includeDone !== undefined ? { includeDone: data.includeDone } : {}),
      },
    });
    if (selectedListIds !== undefined) {
      await tx.calendarFeedList.deleteMany({ where: { feedId: id } });
      if (selectedListIds.length > 0) {
        await tx.calendarFeedList.createMany({
          data: selectedListIds.map((listId) => ({ feedId: id, listId })),
        });
      }
    }
  });
  const updated = await _prisma.calendarFeedToken.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      includeDone: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
      updatedAt: true,
      lists: {
        select: { listId: true },
        orderBy: { listId: "asc" },
      },
    },
  });
  if (!updated) {
    return null;
  }
  return {
    ...updated,
    listIds: updated.lists.map((item) => item.listId),
  };
}

async function rotateCalendarFeedToken(id: string, userId: string) {
  const token = createCalendarTokenSecret();
  const tokenHash = sha256Hex(token);
  const result = await _prisma.calendarFeedToken.updateMany({
    where: { id, userId, isActive: true },
    data: { tokenHash },
  });
  if (result.count === 0) {
    return null;
  }
  return { token };
}

async function findActiveCalendarFeedByToken(token: string) {
  const tokenHash = sha256Hex(token);
  const feed = await _prisma.calendarFeedToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      includeDone: true,
      isActive: true,
      expiresAt: true,
      lists: { select: { listId: true } },
    },
  });
  if (!feed || !feed.isActive) {
    return null;
  }
  if (feed.expiresAt && feed.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  return feed;
}

async function touchCalendarFeedUsage(id: string): Promise<void> {
  await _prisma.calendarFeedToken.update({
    where: { id },
    data: { lastUsedAt: new Date() },
  });
}

async function listCalendarTasksForUser(
  userId: string,
  includeDone: boolean,
  listIds: string[],
) {
  return _prisma.task.findMany({
    where: {
      listId: { in: listIds },
      dueDate: { not: null },
      ...(includeDone ? {} : { done: false }),
    },
    include: {
      list: { select: { id: true, title: true } },
      recurringRule: true,
    },
    orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
  });
}

// -------------------------------------------------- API Keys --------------------------------------------------

async function listApiKeys(userId: string) {
  return _prisma.apiKey.findMany({
    where: { userId },
    select: { id: true, name: true, keyPrefix: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function createApiKey(
  userId: string,
  name: string,
): Promise<{ id: string; name: string; keyPrefix: string; createdAt: Date; plainKey: string }> {
  const rawKey = randomBytes(32).toString('hex');
  const keyPrefix = rawKey.slice(0, 8);
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const record = await _prisma.apiKey.create({
    data: { userId, name, keyHash, keyPrefix },
    select: { id: true, name: true, keyPrefix: true, createdAt: true },
  });
  return { ...record, plainKey: rawKey };
}

async function deleteApiKey(id: string, userId: string): Promise<boolean> {
  const existing = await _prisma.apiKey.findFirst({ where: { id, userId } });
  if (!existing) {
    return false;
  }
  await _prisma.apiKey.delete({ where: { id } });
  return true;
}

async function findApiKeyByRawKey(rawKey: string): Promise<{ id: string; userId: string } | null> {
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  return _prisma.apiKey.findUnique({
    where: { keyHash },
    select: { id: true, userId: true },
  });
}

async function touchApiKeyUsage(id: string): Promise<void> {
  await _prisma.apiKey.update({ where: { id }, data: { lastUsedAt: new Date() } });
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
  upsertPushSubscription,
  deletePushSubscriptionByEndpoint,
  listPushSubscriptions,
  listPushSubscriptionsByUser,
  getRecurringRule,
  setRecurringRule,
  deleteRecurringRule,
  findTasksDueForReminder,
  setTaskReminderSent,
  // List Sharing
  listListShares,
  findListShare,
  shareList,
  updateListShare,
  removeListShare,
  listSharedLists,
  // Comments
  listComments,
  createComment,
  updateComment,
  deleteComment,
  checkTaskCommentsAvailability,
  checkCommentCommentsAvailability,
  // Activity Log
  logActivity,
  listActivityLogs,
  listActivityLogsForList,
  // Task Assignments
  assignTask,
  unassignTask,
  listAssignedTasks,
  getListAccess,
  // Calendar feeds
  listCalendarFeeds,
  createCalendarFeed,
  updateCalendarFeed,
  revokeCalendarFeed,
  rotateCalendarFeedToken,
  findActiveCalendarFeedByToken,
  touchCalendarFeedUsage,
  listCalendarTasksForUser,
  // API Keys
  listApiKeys,
  createApiKey,
  deleteApiKey,
  findApiKeyByRawKey,
  touchApiKeyUsage,
};
