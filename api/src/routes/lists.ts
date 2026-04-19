// node_modules
import { type FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';

// classes
import { jwtPreHandler } from '../classes/auth';
import { db } from '../classes/database';

// ---- GET /api/lists — list all lists for authenticated user
// ---- POST /api/lists — create a list
// ---- PATCH /api/lists/:id — update a list
// ---- DELETE /api/lists/:id — delete a list
// ---- PATCH /api/lists/reorder — reorder lists
export async function listsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/lists', { preHandler: jwtPreHandler }, async (request) => {
    const userId = request.jwtUser!.userId;
    return db.listLists(userId);
  });

  fastify.post(
    '/api/lists',
    {
      preHandler: jwtPreHandler,
      schema: {
        body: Type.Object({
          title: Type.String({ minLength: 1 }),
          icon: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          color: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          category: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          commentsEnabled: Type.Optional(Type.Boolean()),
        }),
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const body = request.body as {
        title: string;
        icon?: string | null;
        color?: string | null;
        category?: string | null;
        commentsEnabled?: boolean;
      };
      if (body.commentsEnabled !== undefined) {
        const appSettings = await db.getAppSettings();
        if (!appSettings.commentsEnabled) {
          await reply.code(400).send({ error: 'Comments are globally disabled' });
          return;
        }
      }
      const list = await db.createList(userId, {
        title: body.title,
        icon: body.icon ?? undefined,
        color: body.color ?? undefined,
        category: body.category ?? undefined,
        commentsEnabled: body.commentsEnabled,
      });
      await reply.code(201).send(list);
    },
  );

  fastify.patch(
    '/api/lists/:id',
    {
      preHandler: jwtPreHandler,
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({
          title: Type.Optional(Type.String({ minLength: 1 })),
          icon: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          color: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          category: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          commentsEnabled: Type.Optional(Type.Boolean()),
        }),
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      if (body['commentsEnabled'] !== undefined) {
        const appSettings = await db.getAppSettings();
        if (!appSettings.commentsEnabled) {
          await reply.code(400).send({ error: 'Comments are globally disabled' });
          return;
        }
      }
      const updated = await db.updateList(id, userId, body);
      if (!updated) {
        await reply.code(404).send({ error: 'List not found' });
        return;
      }
      await reply.send(updated);
    },
  );

  fastify.delete(
    '/api/lists/:id',
    {
      preHandler: jwtPreHandler,
      schema: { params: Type.Object({ id: Type.String() }) },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const ok = await db.deleteList(id, userId);
      if (!ok) {
        await reply.code(404).send({ error: 'List not found' });
        return;
      }
      await reply.code(204).send();
    },
  );

  fastify.patch(
    '/api/lists/reorder',
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
      await db.reorderLists(userId, items);
      await reply.send({ ok: true });
    },
  );
}
