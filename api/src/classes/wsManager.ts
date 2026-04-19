import type { WebSocket } from '@fastify/websocket';

type WsMessage = Record<string, unknown>;

// Per-user set of active WebSocket connections
const connections = new Map<string, Set<WebSocket>>();

export function registerConnection(userId: string, ws: WebSocket): void {
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add(ws);

  ws.on('close', () => {
    unregisterConnection(userId, ws);
  });
}

export function unregisterConnection(userId: string, ws: WebSocket): void {
  const set = connections.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) {
    connections.delete(userId);
  }
}

export function sendToUser(userId: string, message: WsMessage): void {
  const set = connections.get(userId);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify(message);
  for (const ws of set) {
    try {
      ws.send(payload);
    } catch {
      // ignore send errors on stale sockets
    }
  }
}
