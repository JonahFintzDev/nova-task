// node_modules
import { type FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';

// classes
import { jwtPreHandler } from '../classes/auth';
import { db } from '../classes/database';

// ---- GET /api/tags — list tags for user
// ---- POST /api/tags — create tag
// ---- PATCH /api/tags/:id — update tag
// ---- DELETE /api/tags/:id — delete tag
export async function tagsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/tags', { preHandler: jwtPreHandler }, async (request) => {
    const userId = request.jwtUser!.userId;
    return db.listTags(userId);
  });

  fastify.post(
    '/api/tags',
    {
      preHandler: jwtPreHandler,
      schema: {
        body: Type.Object({
          name: Type.String({ minLength: 1 }),
          color: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        }),
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const body = request.body as { name: string; color?: string | null };
      try {
        const tag = await db.createTag(userId, body);
        await reply.code(201).send(tag);
      } catch {
        await reply.code(409).send({ error: 'Tag name already exists' });
      }
    },
  );

  fastify.patch(
    '/api/tags/:id',
    {
      preHandler: jwtPreHandler,
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({
          name: Type.Optional(Type.String({ minLength: 1 })),
          color: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        }),
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const body = request.body as { name?: string; color?: string | null };
      const updated = await db.updateTag(id, userId, body);
      if (!updated) {
        await reply.code(404).send({ error: 'Tag not found' });
        return;
      }
      await reply.send(updated);
    },
  );

  fastify.delete(
    '/api/tags/:id',
    {
      preHandler: jwtPreHandler,
      schema: { params: Type.Object({ id: Type.String() }) },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const ok = await db.deleteTag(id, userId);
      if (!ok) {
        await reply.code(404).send({ error: 'Tag not found' });
        return;
      }
      await reply.code(204).send();
    },
  );
}
