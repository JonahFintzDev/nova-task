// node_modules
import '@fastify/multipart';
import { createReadStream, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type FastifyInstance } from 'fastify';

// classes
import { jwtPreHandler } from '../classes/auth';
import { db } from '../classes/database';
import { config } from '../classes/config';

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function avatarsDir(): string {
  const dir = join(config.configDir, 'uploads', 'avatars');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function avatarFilePath(userId: string, ext: string): string {
  return join(avatarsDir(), `${userId}.${ext}`);
}

// ---- GET /api/users/:userId/avatar — serve avatar image (no auth required)
// ---- POST /api/users/avatar       — upload own avatar (auth required)
// ---- DELETE /api/users/avatar     — remove own avatar (auth required)
export async function avatarRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/users/:userId/avatar', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const user = await db.findUserById(userId);
    if (!user || !user.avatarExt) {
      await reply.code(404).send({ error: 'No avatar' });
      return;
    }
    const filePath = avatarFilePath(userId, user.avatarExt);
    if (!existsSync(filePath)) {
      await reply.code(404).send({ error: 'No avatar' });
      return;
    }
    const mimeType =
      Object.entries(ALLOWED_TYPES).find(([, e]) => e === user.avatarExt)?.[0] ??
      'application/octet-stream';
    await reply
      .header('Content-Type', mimeType)
      .header('Cache-Control', 'public, max-age=3600')
      .send(createReadStream(filePath));
  });

  fastify.post('/api/users/avatar', { preHandler: jwtPreHandler }, async (request, reply) => {
    const userId = request.jwtUser!.userId;

    const data = await request.file();
    if (!data) {
      await reply.code(400).send({ error: 'No file uploaded' });
      return;
    }

    const ext = ALLOWED_TYPES[data.mimetype];
    if (!ext) {
      // drain stream before returning
      data.file.resume();
      await reply
        .code(400)
        .send({ error: 'Unsupported file type. Use JPEG, PNG, WebP, or GIF.' });
      return;
    }

    // Accumulate chunks with size guard
    const chunks: Buffer[] = [];
    let bytesRead = 0;
    let tooLarge = false;
    for await (const chunk of data.file) {
      bytesRead += (chunk as Buffer).length;
      if (bytesRead > MAX_BYTES) {
        tooLarge = true;
        break;
      }
      chunks.push(chunk as Buffer);
    }
    // drain any remaining bytes after early break
    if (tooLarge) {
      data.file.resume();
      await reply.code(413).send({ error: 'File too large. Maximum size is 5 MB.' });
      return;
    }

    // Remove old avatar file if extension differs
    const existing = await db.findUserById(userId);
    if (existing?.avatarExt && existing.avatarExt !== ext) {
      const oldPath = avatarFilePath(userId, existing.avatarExt);
      if (existsSync(oldPath)) unlinkSync(oldPath);
    }

    writeFileSync(avatarFilePath(userId, ext), Buffer.concat(chunks));
    await db.updateUser(userId, { avatarExt: ext });

    await reply.send({ avatarUrl: `/api/users/${userId}/avatar` });
  });

  fastify.delete('/api/users/avatar', { preHandler: jwtPreHandler }, async (request, reply) => {
    const userId = request.jwtUser!.userId;
    const user = await db.findUserById(userId);
    if (user?.avatarExt) {
      const filePath = avatarFilePath(userId, user.avatarExt);
      if (existsSync(filePath)) unlinkSync(filePath);
      await db.updateUser(userId, { avatarExt: null });
    }
    await reply.send({ ok: true });
  });
}
