/// <reference lib="webworker" />
// node_modules
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload: {
    title?: string;
    body?: string;
    tag?: string;
    icon?: string;
    url?: string;
  } = {};
  try {
    payload = event.data.json() as typeof payload;
  } catch {
    payload = { body: event.data.text() };
  }
  const title = payload.title || 'Nova Task';
  const options: NotificationOptions = {
    body: payload.body || '',
    tag: payload.tag,
    icon: payload.icon || '/icon-192.png',
    data: { url: payload.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data as { url?: string } | undefined;
  const target = data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ('focus' in client) {
          void client.focus();
          if ('navigate' in client) void client.navigate(target);
          return;
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

// Task lists: never serve cached JSON (avoids empty/stale lists after reconnecting).
// Other GET /api/* still uses network-first with offline fallback.
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' && url.pathname.startsWith('/api/tasks'),
  new NetworkOnly(),
);

// API: try network first (fresh data when online); fall back to cache when offline
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'nova-task-api',
    networkTimeoutSeconds: 8,
    plugins: [
      {
        cacheWillUpdate: async ({ response }) => {
          return response && response.status === 200 ? response : null;
        },
      },
    ],
  }),
);

// Same-origin static assets not covered by precache (e.g. icons): cache-first
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    (request.destination === 'font' ||
      request.destination === 'image' ||
      request.destination === 'style'),
  new CacheFirst({
    cacheName: 'nova-task-static',
  }),
);
