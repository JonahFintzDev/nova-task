// node_modules
import { type FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';

// classes
import { comparePassword, hashPassword, jwtPreHandler, signToken, verifyToken } from '../classes/auth';
import { db } from '../classes/database';

// ---- POST /api/auth/register — create account; first user = admin; check registrationEnabled
// ---- POST /api/auth/login — returns JWT
// ---- POST /api/auth/validate — validate token, returns { valid, username, userId, isAdmin }
// ---- PATCH /api/auth/password — change own password (requires auth)
export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/api/auth/register',
    {
      schema: {
        body: Type.Object({
          username: Type.String({ minLength: 1 }),
          password: Type.String({ minLength: 1 }),
        }),
      },
    },
    async (request, reply) => {
      const { username, password } = request.body as { username: string; password: string };
      const appSettings = await db.getAppSettings();
      if (!appSettings.registrationEnabled) {
        await reply.code(403).send({ error: 'Registration disabled' });
        return;
      }
      const existing = await db.findUserByUsername(username.trim());
      if (existing) {
        await reply.code(409).send({ error: 'Username already taken' });
        return;
      }
      const userCount = await db.countUsers();
      const isAdmin = userCount === 0;
      const passwordHash = await hashPassword(password);
      const user = await db.createUser({
        username: username.trim(),
        passwordHash,
        isAdmin,
      });
      const token = signToken(user.id, user.username, user.isAdmin);
      await reply.send({ token });
    },
  );

  fastify.post(
    '/api/auth/login',
    {
      schema: {
        body: Type.Object({
          username: Type.String({ minLength: 1 }),
          password: Type.String({ minLength: 1 }),
        }),
      },
    },
    async (request, reply) => {
      const { username, password } = request.body as { username: string; password: string };
      const user = await db.findUserByUsername(username.trim());
      if (!user) {
        await reply.code(401).send({ error: 'Invalid credentials' });
        return;
      }
      const valid = await comparePassword(password, user.passwordHash);
      if (!valid) {
        await reply.code(401).send({ error: 'Invalid credentials' });
        return;
      }
      const token = signToken(user.id, user.username, user.isAdmin);
      await reply.send({ token });
    },
  );

  fastify.post('/api/auth/validate', async (request, reply) => {
    const header = request.headers['authorization'];
    if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) {
      await reply.send({ valid: false, username: null, userId: null, isAdmin: false });
      return;
    }
    const token = header.slice(7);
    try {
      const payload = verifyToken(token);
      const user = await db.findUserById(payload.userId);
      if (!user) {
        await reply.send({ valid: false, username: null, userId: null, isAdmin: false });
        return;
      }
      const avatarUrl = user.avatarExt ? `/api/users/${user.id}/avatar` : null;
      await reply.send({
        valid: true,
        username: user.username,
        userId: user.id,
        isAdmin: user.isAdmin,
        avatarUrl,
      });
    } catch {
      await reply.send({ valid: false, username: null, userId: null, isAdmin: false });
    }
  });

  fastify.patch(
    '/api/auth/password',
    {
      preHandler: jwtPreHandler,
      schema: {
        body: Type.Object({
          currentPassword: Type.String({ minLength: 1 }),
          newPassword: Type.String({ minLength: 1 }),
        }),
      },
    },
    async (request, reply) => {
      const userId = request.jwtUser!.userId;
      const { currentPassword, newPassword } = request.body as {
        currentPassword: string;
        newPassword: string;
      };
      const user = await db.findUserById(userId);
      if (!user) {
        await reply.code(401).send({ error: 'Unauthorized' });
        return;
      }
      const valid = await comparePassword(currentPassword, user.passwordHash);
      if (!valid) {
        await reply.code(400).send({ error: 'Current password is incorrect' });
        return;
      }
      const passwordHash = await hashPassword(newPassword);
      await db.updateUser(userId, { passwordHash });
      await reply.send({ ok: true });
    },
  );
}
