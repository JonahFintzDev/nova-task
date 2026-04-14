import type { JwtUser } from './index';

declare module 'fastify' {
  interface FastifyRequest {
    jwtUser: JwtUser | null;
  }
}
