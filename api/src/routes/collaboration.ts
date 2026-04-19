// node_modules
import { type FastifyInstance, type FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';

// classes
import { jwtPreHandler } from '../classes/auth';
import { db } from '../classes/database';

const permissionValues = Type.Union([
  Type.Literal('READ'),
  Type.Literal('WRITE'),
  Type.Literal('ADMIN'),
]);

// ---- GET /api/shared-lists — lists shared with current user
// ---- GET /api/lists/:id/shares — list shares for a specific list (owner only)
// ---- POST /api/lists/:id/shares — share a list with a user (owner only)
// ---- PATCH /api/lists/:id/shares/:userId — update share permission (owner only)
// ---- DELETE /api/lists/:id/shares/:userId — remove a share (owner only)
// ---- GET /api/tasks/:id/comments — list comments on a task
// ---- POST /api/tasks/:id/comments — add a comment to a task
// ---- PATCH /api/comments/:id — update a comment
// ---- DELETE /api/comments/:id — delete a comment
// ---- GET /api/activity — list current user's activity logs
// ---- GET /api/lists/:id/activity — list activity logs for a list
// ---- GET /api/tasks/:id/activity — list activity logs for a task
// ---- GET /api/assigned-tasks — list tasks assigned to current user
// ---- POST /api/tasks/:id/assign — assign a task to a user
// ---- DELETE /api/tasks/:id/assign — unassign a task
export async function collaborationRoutes(fastify: FastifyInstance): Promise<void> {
  const ensureCommentsEnabled = async (reply: FastifyReply): Promise<boolean> => {
    const settings = await db.getAppSettings();
    if (settings.commentsEnabled) {
      return true;
    }
    await reply.code(403).send({ error: 'Comments are disabled' });
    return false;
  };

  // Shared lists - lists shared with current user
  fastify.get('/api/shared-lists', { preHandler: jwtPreHandler }, async (request) => {
    const userId = request.jwtUser!.userId;
    return db.listSharedLists(userId);
  });

  // List shares management (for list owners)
  fastify.get(
    '/api/lists/:id/shares',
    { preHandler: jwtPreHandler, schema: { params: Type.Object({ id: Type.String() }) } },
    async (request, reply) => {
      if (!(await ensureCommentsEnabled(reply))) {
        return;
      }
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const shares = await db.listListShares(id, userId);
      if (shares === null) {
        await reply.code(404).send({ error: 'List not found' });
        return;
      }
      await reply.send(shares);
    },
  );

  fastify.post(
    '/api/lists/:id/shares',
    {
      preHandler: jwtPreHandler,
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({
          username: Type.String({ minLength: 1 }),
          permission: permissionValues,
        }),
      },
    },
    async (request, reply) => {
      if (!(await ensureCommentsEnabled(reply))) {
        return;
      }
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const body = request.body as { username: string; permission: 'READ' | 'WRITE' | 'ADMIN' };
      const result = await db.shareList(id, userId, body);
      if (!result.success) {
        const status =
          result.error === 'List not found'
            ? 404
            : result.error === 'User not found'
              ? 404
              : result.error === 'Already shared with this user'
                ? 409
                : 400;
        await reply.code(status).send({ error: result.error });
        return;
      }
      await reply.code(201).send(result.share);
    },
  );

  fastify.patch(
    '/api/lists/:id/shares/:targetUserId',
    {
      preHandler: jwtPreHandler,
      schema: {
        params: Type.Object({ id: Type.String(), targetUserId: Type.String() }),
        body: Type.Object({
          permission: permissionValues,
        }),
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { id, targetUserId } = request.params as { id: string; targetUserId: string };
      const body = request.body as { permission: 'READ' | 'WRITE' | 'ADMIN' };
      const updated = await db.updateListShare(id, userId, targetUserId, body);
      if (!updated) {
        await reply.code(404).send({ error: 'Share not found' });
        return;
      }
      await reply.send(updated);
    },
  );

  fastify.delete(
    '/api/lists/:id/shares/:targetUserId',
    {
      preHandler: jwtPreHandler,
      schema: {
        params: Type.Object({ id: Type.String(), targetUserId: Type.String() }),
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { id, targetUserId } = request.params as { id: string; targetUserId: string };
      const ok = await db.removeListShare(id, userId, targetUserId);
      if (!ok) {
        await reply.code(404).send({ error: 'Share not found' });
        return;
      }
      await reply.code(204).send();
    },
  );

  // Comments
  fastify.get(
    '/api/tasks/:id/comments',
    {
      preHandler: jwtPreHandler,
      schema: { params: Type.Object({ id: Type.String() }) },
    },
    async (request, reply) => {
      if (!(await ensureCommentsEnabled(reply))) {
        return;
      }
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const availability = await db.checkTaskCommentsAvailability(id, userId);
      if (availability === 'DISABLED') {
        await reply.code(403).send({ error: 'Comments are disabled for this list' });
        return;
      }
      const comments = await db.listComments(id, userId);
      if (comments === null) {
        await reply.code(404).send({ error: 'Task not found or access denied' });
        return;
      }
      await reply.send(comments);
    },
  );

  fastify.post(
    '/api/tasks/:id/comments',
    {
      preHandler: jwtPreHandler,
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({
          content: Type.String({ minLength: 1, maxLength: 5000 }),
        }),
      },
    },
    async (request, reply) => {
      if (!(await ensureCommentsEnabled(reply))) {
        return;
      }
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const availability = await db.checkTaskCommentsAvailability(id, userId);
      if (availability === 'DISABLED') {
        await reply.code(403).send({ error: 'Comments are disabled for this list' });
        return;
      }
      const body = request.body as { content: string };
      const comment = await db.createComment(userId, { taskId: id, content: body.content });
      if (!comment) {
        await reply.code(404).send({ error: 'Task not found or access denied' });
        return;
      }
      await reply.code(201).send(comment);
    },
  );

  fastify.patch(
    '/api/comments/:id',
    {
      preHandler: jwtPreHandler,
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({
          content: Type.String({ minLength: 1, maxLength: 5000 }),
        }),
      },
    },
    async (request, reply) => {
      if (!(await ensureCommentsEnabled(reply))) {
        return;
      }
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const availability = await db.checkCommentCommentsAvailability(id, userId);
      if (availability === 'DISABLED') {
        await reply.code(403).send({ error: 'Comments are disabled for this list' });
        return;
      }
      const body = request.body as { content: string };
      const updated = await db.updateComment(id, userId, body);
      if (!updated) {
        await reply.code(404).send({ error: 'Comment not found' });
        return;
      }
      await reply.send(updated);
    },
  );

  fastify.delete(
    '/api/comments/:id',
    {
      preHandler: jwtPreHandler,
      schema: { params: Type.Object({ id: Type.String() }) },
    },
    async (request, reply) => {
      if (!(await ensureCommentsEnabled(reply))) {
        return;
      }
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const availability = await db.checkCommentCommentsAvailability(id, userId);
      if (availability === 'DISABLED') {
        await reply.code(403).send({ error: 'Comments are disabled for this list' });
        return;
      }
      const ok = await db.deleteComment(id, userId);
      if (!ok) {
        await reply.code(404).send({ error: 'Comment not found' });
        return;
      }
      await reply.code(204).send();
    },
  );

  // Activity logs
  fastify.get('/api/activity', { preHandler: jwtPreHandler }, async (request) => {
    const userId = request.jwtUser!.userId;
    const query = request.query as { taskId?: string; listId?: string; limit?: string };
    return db.listActivityLogs(userId, {
      taskId: query.taskId,
      listId: query.listId,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  });

  fastify.get(
    '/api/lists/:id/activity',
    {
      preHandler: jwtPreHandler,
      schema: { params: Type.Object({ id: Type.String() }) },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const logs = await db.listActivityLogsForList(id, userId);
      if (logs === null) {
        await reply.code(404).send({ error: 'List not found or access denied' });
        return;
      }
      await reply.send(logs);
    },
  );

  // Assigned tasks
  fastify.get('/api/assigned-tasks', { preHandler: jwtPreHandler }, async (request) => {
    const userId = request.jwtUser!.userId;
    const tasks = await db.listAssignedTasks(userId);
    return tasks.map((task) => ({
      ...task,
      tags: task.tags.map((tt: { tag: { id: string; userId: string; name: string; color: string | null } }) => tt.tag),
    }));
  });

  fastify.post(
    '/api/tasks/:id/assign',
    {
      preHandler: jwtPreHandler,
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({
          username: Type.String({ minLength: 1 }),
        }),
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const body = request.body as { username: string };
      const result = await db.assignTask(id, userId, body.username);
      if (!result.success) {
        const status =
          result.error === 'Task not found'
            ? 404
            : result.error === 'User not found'
              ? 404
              : 400;
        await reply.code(status).send({ error: result.error });
        return;
      }
      await reply.send(result.task);
    },
  );

  fastify.delete(
    '/api/tasks/:id/assign',
    {
      preHandler: jwtPreHandler,
      schema: { params: Type.Object({ id: Type.String() }) },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { id } = request.params as { id: string };
      const task = await db.unassignTask(id, userId);
      if (!task) {
        await reply.code(404).send({ error: 'Task not found' });
        return;
      }
      await reply.send(task);
    },
  );
}
