// node_modules
import { type FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';

// classes
import { jwtPreHandler } from '../classes/auth';
import { db } from '../classes/database';

// ---- GET /api/settings — user preferences
// ---- PATCH /api/settings — update user preferences
export async function settingsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/settings', { preHandler: jwtPreHandler }, async (request, reply) => {
    const userId = request.jwtUser!.userId;
    const settings = await db.getUserSettings(userId);
    if (!settings) {
      await reply.code(404).send({ error: 'User not found' });
      return;
    }
    await reply.send(settings);
  });

  fastify.patch(
    '/api/settings',
    {
      preHandler: jwtPreHandler,
      schema: {
        body: Type.Object({
          language: Type.Optional(Type.Union([Type.Literal('en'), Type.Literal('de')])),
          autoTheme: Type.Optional(Type.Boolean()),
          darkTheme: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          lightTheme: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          aiFeaturesDisabled: Type.Optional(Type.Boolean()),
        }),
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const body = request.body as Record<string, unknown>;
      const updated = await db.updateUserSettings(userId, body);
      await reply.send(updated);
    },
  );
}
