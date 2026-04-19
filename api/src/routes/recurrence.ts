// node_modules
import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';

// classes
import { jwtPreHandler } from '../classes/auth';
import { db } from '../classes/database';

const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const;

export async function recurrenceRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/tasks/:id/recurrence — fetch rule (null if not set)
  fastify.get(
    '/api/tasks/:id/recurrence',
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
      const rule = await db.getRecurringRule(id, userId);
      return rule ?? null;
    },
  );

  // PUT /api/tasks/:id/recurrence — create or update rule
  fastify.put(
    '/api/tasks/:id/recurrence',
    {
      preHandler: jwtPreHandler,
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({
          frequency: Type.Union(VALID_FREQUENCIES.map((f) => Type.Literal(f))),
          interval: Type.Integer({ minimum: 1, maximum: 365 }),
        }),
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const body = request.body as { frequency: string; interval: number };
      const task = await db.findTask(id, userId);
      if (!task) {
        await reply.code(404).send({ error: 'Task not found' });
        return;
      }
      const rule = await db.setRecurringRule(id, userId, {
        frequency: body.frequency,
        interval: body.interval,
      });
      return rule;
    },
  );

  // DELETE /api/tasks/:id/recurrence — remove rule
  fastify.delete(
    '/api/tasks/:id/recurrence',
    {
      preHandler: jwtPreHandler,
      schema: { params: Type.Object({ id: Type.String() }) },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const ok = await db.deleteRecurringRule(id, userId);
      if (!ok) {
        await reply.code(404).send({ error: 'Recurring rule not found' });
        return;
      }
      await reply.code(204).send();
    },
  );
}
