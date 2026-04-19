// node_modules
import { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { Type } from '@sinclair/typebox';

// classes
import { db } from '../classes/database';

// ---- GET    /api/external/sync         — fetch all lists + tasks in one call
// ---- GET    /api/external/lists        — list all lists
// ---- GET    /api/external/tasks        — list tasks (optional ?listId=)
// ---- POST   /api/external/tasks        — create a task
// ---- PATCH  /api/external/tasks/:id   — update a task
// ---- DELETE /api/external/tasks/:id   — delete a task
//
// All routes authenticate via the X-Api-Key header.
// Generate keys in the app's Settings → API Keys page.

// -------------------------------------------------- Auth pre-handler --------------------------------------------------

async function apiKeyPreHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const rawKey = request.headers['x-api-key'];
  if (!rawKey || typeof rawKey !== 'string') {
    await reply.code(401).send({ error: 'Missing X-Api-Key header' });
    return;
  }
  const record = await db.findApiKeyByRawKey(rawKey);
  if (!record) {
    await reply.code(401).send({ error: 'Invalid API key' });
    return;
  }
  await db.touchApiKeyUsage(record.id);
  (request as FastifyRequest & { apiUserId?: string }).apiUserId = record.userId;
}

// -------------------------------------------------- Shared schema fragments --------------------------------------------------

const PrioritySchema = Type.Union(
  [
    Type.Literal('NONE'),
    Type.Literal('LOW'),
    Type.Literal('MEDIUM'),
    Type.Literal('HIGH'),
    Type.Literal('URGENT'),
  ],
  { description: 'Task priority level.' },
);

const ListSchema = Type.Object({
  id: Type.String({ description: 'Unique list identifier.' }),
  title: Type.String({ description: 'Display name of the list.' }),
  icon: Type.Union([Type.String(), Type.Null()], { description: 'Icon name, or null.' }),
  color: Type.Union([Type.String(), Type.Null()], { description: 'Hex color string, or null.' }),
  category: Type.Union([Type.String(), Type.Null()], { description: 'Optional category label.' }),
  sortOrder: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

const TaskSchema = Type.Object({
  id: Type.String({ description: 'Unique task identifier.' }),
  listId: Type.String({ description: 'ID of the parent list.' }),
  title: Type.String({ description: 'Task title.' }),
  description: Type.Union([Type.String(), Type.Null()], { description: 'Optional markdown description.' }),
  dueDate: Type.Union([Type.String({ format: 'date-time' }), Type.Null()], { description: 'Due date/time in ISO-8601, or null.' }),
  dueDateHasTime: Type.Boolean({ description: 'Whether the due date includes a time component.' }),
  priority: PrioritySchema,
  done: Type.Boolean({ description: 'Whether the task is marked complete.' }),
  doneAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  sortOrder: Type.Number(),
  parentTaskId: Type.Union([Type.String(), Type.Null()], { description: 'Parent task ID for subtasks, or null.' }),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

const ErrorSchema = Type.Object({ error: Type.String() });

const SECURITY = [{ apiKey: [] }];

// -------------------------------------------------- Routes --------------------------------------------------

export async function externalRoutes(fastify: FastifyInstance): Promise<void> {
  const pre = apiKeyPreHandler as (req: FastifyRequest, rep: FastifyReply) => Promise<void>;

  // GET /api/external/sync
  fastify.get(
    '/api/external/sync',
    {
      preHandler: pre,
      schema: {
        tags: ['External API'],
        operationId: 'externalSync',
        summary: 'Fetch all lists and tasks',
        description:
          'Returns all lists and their top-level tasks for the key owner in a single request. Ideal as a polling endpoint for integrations.',
        security: SECURITY,
        response: {
          200: Type.Object({
            lists: Type.Array(ListSchema),
            tasks: Type.Array(TaskSchema),
          }),
          401: ErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request as FastifyRequest & { apiUserId?: string }).apiUserId!;
      const [lists, tasks] = await Promise.all([
        db.listLists(userId),
        db.listTasks(userId, { parentTaskId: null }),
      ]);
      await reply.send({ lists, tasks });
    },
  );

  // GET /api/external/lists
  fastify.get(
    '/api/external/lists',
    {
      preHandler: pre,
      schema: {
        tags: ['External API'],
        operationId: 'externalListLists',
        summary: 'List all lists',
        description: 'Returns all task lists belonging to the key owner.',
        security: SECURITY,
        response: {
          200: Type.Array(ListSchema),
          401: ErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request as FastifyRequest & { apiUserId?: string }).apiUserId!;
      const lists = await db.listLists(userId);
      await reply.send(lists);
    },
  );

  // GET /api/external/tasks
  fastify.get(
    '/api/external/tasks',
    {
      preHandler: pre,
      schema: {
        tags: ['External API'],
        operationId: 'externalListTasks',
        summary: 'List tasks',
        description: 'Returns top-level tasks. Filter by list with the optional `listId` query parameter.',
        security: SECURITY,
        querystring: Type.Object({
          listId: Type.Optional(Type.String({ description: 'Filter tasks to a specific list.' })),
        }),
        response: {
          200: Type.Array(TaskSchema),
          401: ErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request as FastifyRequest & { apiUserId?: string }).apiUserId!;
      const { listId } = request.query as { listId?: string };
      const tasks = await db.listTasks(userId, { listId, parentTaskId: null });
      await reply.send(tasks);
    },
  );

  // POST /api/external/tasks
  fastify.post(
    '/api/external/tasks',
    {
      preHandler: pre,
      schema: {
        tags: ['External API'],
        operationId: 'externalCreateTask',
        summary: 'Create a task',
        description: 'Creates a new task in the specified list.',
        security: SECURITY,
        body: Type.Object({
          listId: Type.String({ description: 'ID of the list to add the task to.' }),
          title: Type.String({ minLength: 1, description: 'Task title.' }),
          description: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Optional markdown description.' })),
          dueDate: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'ISO-8601 date or date-time string.' })),
          done: Type.Optional(Type.Boolean({ description: 'Create already completed. Defaults to false.' })),
        }),
        response: {
          201: TaskSchema,
          401: ErrorSchema,
          404: ErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request as FastifyRequest & { apiUserId?: string }).apiUserId!;
      const body = request.body as {
        listId: string;
        title: string;
        description?: string | null;
        dueDate?: string | null;
        done?: boolean;
      };
      let dueDate: Date | null | undefined;
      if (body.dueDate === null) {
        dueDate = null;
      } else if (body.dueDate) {
        const parsed = new Date(body.dueDate);
        dueDate = Number.isNaN(parsed.getTime()) ? null : parsed;
      }
      const task = await db.createTask(userId, {
        listId: body.listId,
        title: body.title,
        description: body.description,
        dueDate,
      });
      if (!task) {
        await reply.code(404).send({ error: 'List not found' });
        return;
      }
      if (body.done) {
        const toggled = await db.toggleDone(task.id, userId);
        await reply.code(201).send(toggled ?? task);
        return;
      }
      await reply.code(201).send(task);
    },
  );

  // PATCH /api/external/tasks/:id
  fastify.patch(
    '/api/external/tasks/:id',
    {
      preHandler: pre,
      schema: {
        tags: ['External API'],
        operationId: 'externalUpdateTask',
        summary: 'Update a task',
        description: 'Partially updates a task. Only the fields you include are changed.',
        security: SECURITY,
        params: Type.Object({ id: Type.String({ description: 'Task ID.' }) }),
        body: Type.Object({
          title: Type.Optional(Type.String({ minLength: 1 })),
          description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          dueDate: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'ISO-8601 string, or null to clear.' })),
          done: Type.Optional(Type.Boolean()),
          priority: Type.Optional(PrioritySchema),
        }),
        response: {
          200: TaskSchema,
          401: ErrorSchema,
          404: ErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request as FastifyRequest & { apiUserId?: string }).apiUserId!;
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const data: Record<string, unknown> = { ...body };
      if (body['dueDate'] !== undefined && body['dueDate'] !== null) {
        const parsed = new Date(body['dueDate'] as string);
        data['dueDate'] = Number.isNaN(parsed.getTime()) ? null : parsed;
      }
      const updated = await db.updateTask(id, userId, data);
      if (!updated) {
        await reply.code(404).send({ error: 'Task not found' });
        return;
      }
      await reply.send(updated);
    },
  );

  // DELETE /api/external/tasks/:id
  fastify.delete(
    '/api/external/tasks/:id',
    {
      preHandler: pre,
      schema: {
        tags: ['External API'],
        operationId: 'externalDeleteTask',
        summary: 'Delete a task',
        description: 'Permanently removes a task and all its subtasks.',
        security: SECURITY,
        params: Type.Object({ id: Type.String({ description: 'Task ID.' }) }),
        response: {
          204: Type.Null(),
          401: ErrorSchema,
          404: ErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = (request as FastifyRequest & { apiUserId?: string }).apiUserId!;
      const { id } = request.params as { id: string };
      const ok = await db.deleteTask(id, userId);
      if (!ok) {
        await reply.code(404).send({ error: 'Task not found' });
        return;
      }
      await reply.code(204).send();
    },
  );
}
