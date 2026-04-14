/// <reference lib="webworker" />
// node_modules
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

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
