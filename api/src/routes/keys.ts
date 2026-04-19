// node_modules
import { type FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';

// classes
import { jwtPreHandler } from '../classes/auth';
import { db } from '../classes/database';

// ---- GET  /api/keys     — list the current user's API keys
// ---- POST /api/keys     — generate a new API key (plain key shown once)
// ---- DELETE /api/keys/:id — revoke an API key

export async function keysRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/keys',
    {
      preHandler: jwtPreHandler,
      schema: {
        tags: ['API Keys'],
        summary: 'List API keys',
        description: 'Returns all API keys belonging to the authenticated user. The plain key value is never returned here — it is only shown once at creation time.',
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Array(
            Type.Object({
              id: Type.String(),
              name: Type.String(),
              keyPrefix: Type.String({ description: 'First 8 characters of the key — useful for identification.' }),
              createdAt: Type.String({ format: 'date-time' }),
              lastUsedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
            }),
          ),
        },
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const keys = await db.listApiKeys(userId);
      await reply.send(keys);
    },
  );

  fastify.post(
    '/api/keys',
    {
      preHandler: jwtPreHandler,
      schema: {
        tags: ['API Keys'],
        summary: 'Generate an API key',
        description: 'Creates a new API key with the given name. The `key` field in the response contains the full plain-text key and is shown **only once** — store it securely.',
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          name: Type.String({ minLength: 1, maxLength: 100, description: 'Human-readable label, e.g. "Home Assistant".' }),
        }),
        response: {
          201: Type.Object({
            id: Type.String(),
            name: Type.String(),
            keyPrefix: Type.String(),
            createdAt: Type.String({ format: 'date-time' }),
            lastUsedAt: Type.Null(),
            key: Type.String({ description: 'Full API key — shown once, store it now.' }),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { name } = request.body as { name: string };
      const created = await db.createApiKey(userId, name.trim());
      await reply.code(201).send({
        id: created.id,
        name: created.name,
        keyPrefix: created.keyPrefix,
        createdAt: created.createdAt,
        lastUsedAt: null,
        key: created.plainKey,
      });
    },
  );

  fastify.delete(
    '/api/keys/:id',
    {
      preHandler: jwtPreHandler,
      schema: {
        tags: ['API Keys'],
        summary: 'Revoke an API key',
        description: 'Permanently deletes the API key. Any integration using it will immediately lose access.',
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.String() }),
        response: {
          204: Type.Null(),
          404: Type.Object({ error: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const ok = await db.deleteApiKey(id, userId);
      if (!ok) {
        await reply.code(404).send({ error: 'API key not found' });
        return;
      }
      await reply.code(204).send();
    },
  );
}
