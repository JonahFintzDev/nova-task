// node_modules
import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';

// classes
import { jwtPreHandler } from '../classes/auth';
import { db } from '../classes/database';
import { getVapidPublicKey, isPushConfigured } from '../classes/push';

export async function pushRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/push/public-key',
    { preHandler: jwtPreHandler },
    async () => {
      const publicKey = getVapidPublicKey();
      return { enabled: isPushConfigured(), publicKey };
    },
  );

  fastify.post(
    '/api/push/subscribe',
    {
      preHandler: jwtPreHandler,
      schema: {
        body: Type.Object({
          endpoint: Type.String({ minLength: 1 }),
          keys: Type.Object({
            p256dh: Type.String({ minLength: 1 }),
            auth: Type.String({ minLength: 1 }),
          }),
        }),
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const body = request.body as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      await db.upsertPushSubscription({
        userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      });
      return reply.code(201).send({ ok: true });
    },
  );

  fastify.post(
    '/api/push/unsubscribe',
    {
      preHandler: jwtPreHandler,
      schema: {
        body: Type.Object({ endpoint: Type.String({ minLength: 1 }) }),
      },
    },
    async (request) => {
      const { endpoint } = request.body as { endpoint: string };
      await db.deletePushSubscriptionByEndpoint(endpoint);
      return { ok: true };
    },
  );
}
