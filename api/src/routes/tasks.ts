// node_modules
import { type FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';

// classes
import { jwtPreHandler } from '../classes/auth';
import { db } from '../classes/database';

// types
import type { Priority } from '../generated/client/enums';

function parseDueDateInput(raw: string | null): Date | null {
  if (raw === null) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

const priorityValues = Type.Union([
  Type.Literal('NONE'),
  Type.Literal('LOW'),
  Type.Literal('MEDIUM'),
  Type.Literal('HIGH'),
  Type.Literal('URGENT'),
]);

// ---- GET /api/tasks — list tasks (query filters)
// ---- GET /api/tasks/:id — single task with subtasks and tags
// ---- POST /api/tasks — create task
// ---- PATCH /api/tasks/:id — update task
// ---- DELETE /api/tasks/:id — delete task
// ---- PATCH /api/tasks/:id/done — toggle done
// ---- PATCH /api/tasks/reorder — reorder tasks
// ---- POST /api/tasks/clear-completed — delete all done tasks in a list
export async function tasksRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/tasks', { preHandler: jwtPreHandler }, async (request, reply) => {
    const userId = request.jwtUser!.userId;
    const query = request.query as Record<string, string | undefined>;
    const params: {
      listId?: string;
      parentTaskId?: string | null;
      done?: boolean;
      priority?: Priority;
      tagId?: string;
    } = {};
    if (query['listId']) {
      params.listId = query['listId'];
    }
    if (query['parentTaskId'] === 'null' || query['parentTaskId'] === '') {
      params.parentTaskId = null;
    } else if (query['parentTaskId']) {
      params.parentTaskId = query['parentTaskId'];
    }
    if (query['done'] === 'true') {
      params.done = true;
    }
    if (query['done'] === 'false') {
      params.done = false;
    }
    if (query['priority']) {
      params.priority = query['priority'] as Priority;
    }
    if (query['tag']) {
      params.tagId = query['tag'];
    }
    return db.listTasks(userId, params);
  });

  fastify.get(
    '/api/tasks/:id',
    {
      preHandler: jwtPreHandler,
      schema: { params: Type.Object({ id: Type.String() }) },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const task = await db.findTask(id, userId);
      if (!task) {
        await reply.code(404).send({ error: 'Task not found' });
        return;
      }
      await reply.send(task);
    },
  );

  fastify.post(
    '/api/tasks',
    {
      preHandler: jwtPreHandler,
      schema: {
        body: Type.Object({
          listId: Type.String(),
          title: Type.String({ minLength: 1 }),
          description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          dueDate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          dueDateHasTime: Type.Optional(Type.Boolean()),
          priority: Type.Optional(priorityValues),
          parentTaskId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          tagIds: Type.Optional(Type.Array(Type.String())),
        }),
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const body = request.body as {
        listId: string;
        title: string;
        description?: string | null;
        dueDate?: string | null;
        dueDateHasTime?: boolean;
        priority?: Priority;
        parentTaskId?: string | null;
        tagIds?: string[];
      };
      const parentTaskId =
        typeof body.parentTaskId === 'string'
          ? body.parentTaskId.trim() || null
          : body.parentTaskId ?? null;
      let dueDate: Date | null | undefined;
      if (body.dueDate === null) {
        dueDate = null;
      } else if (body.dueDate === undefined) {
        dueDate = undefined;
      } else {
        dueDate = parseDueDateInput(body.dueDate);
      }
      const task = await db.createTask(userId, {
        listId: body.listId,
        title: body.title,
        description: body.description,
        dueDate,
        dueDateHasTime: body.dueDateHasTime,
        priority: body.priority,
        parentTaskId,
        tagIds: body.tagIds,
      });
      if (!task) {
        if (parentTaskId) {
          const listExists = await db.findList(body.listId, userId);
          await reply
            .code(listExists ? 400 : 404)
            .send({
              error: listExists
                ? 'A subtask cannot have its own subtasks'
                : 'List not found',
            });
          return;
        }
        await reply.code(404).send({ error: 'List not found' });
        return;
      }
      await reply.code(201).send(task);
    },
  );

  fastify.patch(
    '/api/tasks/:id',
    {
      preHandler: jwtPreHandler,
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({
          title: Type.Optional(Type.String({ minLength: 1 })),
          description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          dueDate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          dueDateHasTime: Type.Optional(Type.Boolean()),
          priority: Type.Optional(priorityValues),
          done: Type.Optional(Type.Boolean()),
          listId: Type.Optional(Type.String()),
          parentTaskId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          tagIds: Type.Optional(Type.Array(Type.String())),
        }),
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const data: Record<string, unknown> = { ...body };
      if (body['dueDate'] !== undefined) {
        const raw = body['dueDate'];
        if (raw === null) {
          data['dueDate'] = null;
        } else if (typeof raw === 'string') {
          data['dueDate'] = parseDueDateInput(raw);
        }
      }
      const updated = await db.updateTask(id, userId, data);
      if (!updated) {
        await reply.code(404).send({ error: 'Task not found' });
        return;
      }
      await reply.send(updated);
    },
  );

  fastify.delete(
    '/api/tasks/:id',
    {
      preHandler: jwtPreHandler,
      schema: { params: Type.Object({ id: Type.String() }) },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const ok = await db.deleteTask(id, userId);
      if (!ok) {
        await reply.code(404).send({ error: 'Task not found' });
        return;
      }
      await reply.code(204).send();
    },
  );

  fastify.patch(
    '/api/tasks/:id/done',
    {
      preHandler: jwtPreHandler,
      schema: { params: Type.Object({ id: Type.String() }) },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const task = await db.toggleDone(id, userId);
      if (!task) {
        await reply.code(404).send({ error: 'Task not found' });
        return;
      }
      await reply.send(task);
    },
  );

  fastify.patch(
    '/api/tasks/reorder',
    {
      preHandler: jwtPreHandler,
      schema: {
        body: Type.Object({
          items: Type.Array(
            Type.Object({
              id: Type.String(),
              sortOrder: Type.Integer(),
            }),
          ),
        }),
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { items } = request.body as { items: { id: string; sortOrder: number }[] };
      await db.reorderTasks(userId, items);
      await reply.send({ ok: true });
    },
  );

  fastify.post(
    '/api/tasks/clear-completed',
    {
      preHandler: jwtPreHandler,
      schema: {
        body: Type.Object({ listId: Type.String() }),
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { listId } = request.body as { listId: string };
      const list = await db.findList(listId, userId);
      if (!list) {
        await reply.code(404).send({ error: 'List not found' });
        return;
      }
      const count = await db.deleteDoneTasksInList(listId, userId);
      await reply.send({ deleted: count });
    },
  );
}
