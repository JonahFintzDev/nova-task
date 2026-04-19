// node_modules
import { type FastifyInstance } from 'fastify';

// classes
import { db } from '../classes/database';

// ---- GET /api/health — health check; needsSetup = (userCount === 0)
export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/health', async () => {
    const userCount = await db.countUsers();
    const appSettings = await db.getAppSettings();
    return {
      ok: true,
      needsSetup: userCount === 0,
      registrationEnabled: appSettings.registrationEnabled,
      commentsEnabled: appSettings.commentsEnabled,
    };
  });
}
