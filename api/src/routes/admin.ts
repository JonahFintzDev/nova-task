// node_modules
import { type FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';

// classes
import { adminRolePreHandler, jwtPreHandler } from '../classes/auth';
import { db } from '../classes/database';

// ---- GET /api/admin/users — list users
// ---- PATCH /api/admin/users/:id — edit user
// ---- DELETE /api/admin/users/:id — delete user
// ---- GET /api/admin/settings — app settings
// ---- PATCH /api/admin/settings — update app settings
export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  const adminOnly = { preHandler: [jwtPreHandler, adminRolePreHandler] };

  fastify.get('/api/admin/users', adminOnly, async () => {
    return db.listUsers();
  });

  fastify.patch(
    '/api/admin/users/:id',
    {
      preHandler: [jwtPreHandler, adminRolePreHandler],
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({
          isAdmin: Type.Optional(Type.Boolean()),
        }),
      },
    },
    async (request, reply) => {
      const actorId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const { isAdmin } = request.body as { isAdmin?: boolean };
      if (id === actorId && isAdmin === false) {
        await reply.code(400).send({ error: 'Cannot demote yourself' });
        return;
      }
      const updated = await db.updateUser(id, { isAdmin });
      if (!updated) {
        await reply.code(404).send({ error: 'User not found' });
        return;
      }
      await reply.send(updated);
    },
  );

  fastify.delete(
    '/api/admin/users/:id',
    {
      preHandler: [jwtPreHandler, adminRolePreHandler],
      schema: { params: Type.Object({ id: Type.String() }) },
    },
    async (request, reply) => {
      const actorId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      if (id === actorId) {
        await reply.code(400).send({ error: 'Cannot delete yourself' });
        return;
      }
      const ok = await db.deleteUser(id);
      if (!ok) {
        await reply.code(404).send({ error: 'User not found' });
        return;
      }
      await reply.code(204).send();
    },
  );

  fastify.get('/api/admin/settings', adminOnly, async () => {
    return db.getAppSettings();
  });

  fastify.patch(
    '/api/admin/settings',
    {
      preHandler: [jwtPreHandler, adminRolePreHandler],
      schema: {
        body: Type.Object({
          registrationEnabled: Type.Optional(Type.Boolean()),
        }),
      },
    },
    async (request, reply) => {
      const body = request.body as { registrationEnabled?: boolean };
      await db.updateAppSettings(body);
      await reply.send(await db.getAppSettings());
    },
  );
}
