// node_modules
import { type FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import OpenAI from 'openai';

// classes
import { adminRolePreHandler, jwtPreHandler } from '../classes/auth';
import { db } from '../classes/database';

// ---- GET /api/admin/users — list users
// ---- PATCH /api/admin/users/:id — edit user
// ---- DELETE /api/admin/users/:id — delete user
// ---- GET /api/admin/settings — app settings
// ---- PATCH /api/admin/settings — update app settings
// ---- POST /api/admin/ai/test — test AI endpoint connectivity
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
    const settings = await db.getAppSettings();
    // Never expose the raw API key to the frontend
    return { ...settings, aiApiKey: settings.aiApiKey ? '••••••••' : null };
  });

  fastify.patch(
    '/api/admin/settings',
    {
      preHandler: [jwtPreHandler, adminRolePreHandler],
      schema: {
        body: Type.Object({
          registrationEnabled: Type.Optional(Type.Boolean()),
          commentsEnabled: Type.Optional(Type.Boolean()),
          aiApiUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          aiApiKey: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          aiModel: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        }),
      },
    },
    async (request, reply) => {
      const body = request.body as {
        registrationEnabled?: boolean;
        commentsEnabled?: boolean;
        aiApiUrl?: string | null;
        aiApiKey?: string | null;
        aiModel?: string | null;
      };
      await db.updateAppSettings(body);
      const settings = await db.getAppSettings();
      // Never return the raw API key to the client
      await reply.send({ ...settings, aiApiKey: settings.aiApiKey ? '••••••••' : null });
    },
  );

  fastify.post(
    '/api/admin/ai/test',
    {
      preHandler: [jwtPreHandler, adminRolePreHandler],
      schema: {
        body: Type.Object({
          // The caller sends whatever is currently in the form fields.
          // An empty/omitted value means "use what is already saved".
          aiApiUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          aiApiKey: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          aiModel: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        }),
      },
    },
    async (request, reply) => {
      const body = request.body as {
        aiApiUrl?: string | null;
        aiApiKey?: string | null;
        aiModel?: string | null;
      };

      // Merge form values with saved settings, form takes precedence
      const saved = await db.getAppSettings();

      const apiUrl = body.aiApiUrl?.trim() || saved.aiApiUrl;
      const apiKey = body.aiApiKey?.trim() || saved.aiApiKey;
      const model = body.aiModel?.trim() || saved.aiModel;

      if (!apiUrl || !model) {
        await reply.send({ ok: false, error: 'API URL and model are required.' });
        return;
      }

      try {
        const client = new OpenAI({
          baseURL: apiUrl,
          apiKey: apiKey ?? 'no-key',
          // Short timeout so the test doesn't hang
          timeout: 15_000,
          maxRetries: 0,
        });

        await client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
          max_tokens: 5,
          stream: false,
        });

        await reply.send({ ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await reply.send({ ok: false, error: message });
      }
    },
  );
}
