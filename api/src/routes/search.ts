// node_modules
import { type FastifyInstance } from 'fastify';

// classes
import { jwtPreHandler } from '../classes/auth';
import { db } from '../classes/database';

// types
import type { Priority } from '../generated/client/enums';

// ---- GET /api/search — search lists and tasks
export async function searchRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/search', { preHandler: jwtPreHandler }, async (request) => {
    const userId = request.jwtUser!.userId;
    const query = request.query as Record<string, string | undefined>;
    const q = query['q'] ?? '';
    const filters: { listId?: string; done?: boolean; priority?: Priority; tagId?: string } = {};
    if (query['listId']) {
      filters.listId = query['listId'];
    }
    if (query['done'] === 'true') {
      filters.done = true;
    }
    if (query['done'] === 'false') {
      filters.done = false;
    }
    if (query['priority']) {
      filters.priority = query['priority'] as Priority;
    }
    if (query['tagId']) {
      filters.tagId = query['tagId'];
    }
    return db.searchTasksAndLists(userId, q, filters);
  });
}
