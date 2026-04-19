// node_modules
import { onMounted, onUnmounted } from 'vue';

// classes
import { getApiReachable, subscribeApiReachable } from '@/classes/api';

// lib
import { browserReportsOnline } from '@/lib/pwa-offline-tasks';

/**
 * Runs `refetch` when the app transitions from "cannot load from API" to reachable
 * (browser online + API reachable). Covers staying on the same route after offline
 * where the initial mount already ran with an empty task snapshot.
 */
export function useRefetchWhenReachable(refetch: () => void | Promise<void>): void {
  const canFetch = (): boolean => browserReportsOnline() && getApiReachable();

  let lastCouldFetch = canFetch();

  const tick = (): void => {
    const next = canFetch();
    if (next && !lastCouldFetch) {
      void refetch();
    }
    lastCouldFetch = next;
  };

  const onBrowserOffline = (): void => {
    lastCouldFetch = false;
  };

  let unsubReachability: (() => void) | null = null;

  onMounted(() => {
    lastCouldFetch = canFetch();
    window.addEventListener('online', tick);
    window.addEventListener('offline', onBrowserOffline);
    unsubReachability = subscribeApiReachable(() => {
      tick();
    });
  });

  onUnmounted(() => {
    window.removeEventListener('online', tick);
    window.removeEventListener('offline', onBrowserOffline);
    unsubReachability?.();
  });
}
