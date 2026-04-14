// node_modules
import { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// classes
import { config } from './config';
import { db } from './database';

// types
import type { JwtUser } from '../@types/index';

// -------------------------------------------------- JWT --------------------------------------------------

interface JwtPayload {
  userId: string;
  username: string;
  isAdmin: boolean;
  iat?: number;
  exp?: number;
}

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(userId: string, username: string, isAdmin: boolean): string {
  const payload: JwtPayload = { userId, username, isAdmin };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '30d' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}

// -------------------------------------------------- Fastify helpers --------------------------------------------------

export function extractBearerToken(request: FastifyRequest): string | null {
  const header = request.headers['authorization'];
  if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice(7);
}

export async function jwtPreHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = extractBearerToken(request);
  if (!token) {
    await reply.code(401).send({ error: 'Missing authorization token' });
    return;
  }
  try {
    const payload = verifyToken(token);
    const user = await db.findUserById(payload.userId);
    if (!user) {
      await reply.code(401).send({ error: 'Invalid or expired token' });
      return;
    }
    request.jwtUser = {
      userId: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
    };
  } catch {
    await reply.code(401).send({ error: 'Invalid or expired token' });
    return;
  }
}

export async function adminRolePreHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.jwtUser?.isAdmin) {
    await reply.code(403).send({ error: 'Admin access required' });
    return;
  }
}

export function registerAuth(fastify: FastifyInstance): void {
  fastify.decorateRequest<JwtUser | null>('jwtUser', null);
}
