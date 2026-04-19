// node_modules
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';

// classes
import { verifyToken } from '../classes/auth';
import { registerConnection } from '../classes/wsManager';

// ---- GET /api/ws?token=<jwt>  — WebSocket upgrade
export async function wsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/ws',
    { websocket: true },
    (socket: WebSocket, request) => {
      const raw = request.query as Record<string, string>;
      const token = raw['token'] ?? '';

      let userId: string | null = null;
      try {
        const payload = verifyToken(token);
        userId = payload.userId;
      } catch {
        socket.close(4001, 'Unauthorized');
        return;
      }

      registerConnection(userId, socket);

      // Keep-alive pong
      socket.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as { type?: string };
          if (msg.type === 'ping') {
            socket.send(JSON.stringify({ type: 'pong' }));
          }
        } catch {
          // ignore malformed messages
        }
      });
    },
  );
}
