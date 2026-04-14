// node_modules
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

// stores
import { useAuthStore } from '@/stores/auth';

// classes
import { healthApi } from '@/classes/api';

let cachedNeedsSetup: boolean | null = null;

export async function fetchNeedsSetup(): Promise<boolean> {
  const health = await healthApi.check();
  cachedNeedsSetup = health.needsSetup;
  return health.needsSetup;
}

export function getCachedNeedsSetup(): boolean | null {
  return cachedNeedsSetup;
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, titleKey: 'auth.login' },
  },
  {
    path: '/setup',
    name: 'setup',
    component: () => import('@/views/SetupView.vue'),
    meta: { public: true, titleKey: 'auth.setupTitle' },
  },
  {
    path: '/',
    component: () => import('@/components/layout/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/views/HomeView.vue'),
        meta: { titleKey: 'nav.home' },
      },
      {
        path: 'list/:id',
        name: 'list',
        component: () => import('@/views/ListView.vue'),
        meta: { titleKey: 'nav.lists' },
      },
      {
        path: 'tasks',
        name: 'all-tasks',
        component: () => import('@/views/AllTasksView.vue'),
        meta: { titleKey: 'nav.allTasks' },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { titleKey: 'settings.title' },
      },
      {
        path: 'admin',
        name: 'admin',
        component: () => import('@/views/AdminView.vue'),
        meta: { requiresAdmin: true, titleKey: 'admin.title' },
      },
    ],
  },
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  const needsSetup = cachedNeedsSetup ?? (await fetchNeedsSetup());

  if (to.name === 'setup' && !needsSetup) {
    return { name: 'login' };
  }

  if (to.name === 'login' && needsSetup) {
    return { name: 'setup' };
  }

  const requiresAuth = to.matched.some((record) => record.meta['requiresAuth']);
  if (requiresAuth) {
    if (!authStore.validated) {
      const ok = await authStore.validate();
      if (!ok) {
        if (needsSetup) {
          return { name: 'setup' };
        }
        return { name: 'login', query: { redirect: to.fullPath } };
      }
    }
  }

  if (to.matched.some((record) => record.meta['requiresAdmin']) && !authStore.isAdmin) {
    return { name: 'home' };
  }

  if (to.meta['public'] && authStore.validated && (to.name === 'login' || to.name === 'setup')) {
    return { name: 'home' };
  }

  return true;
});

router.afterEach((to) => {
  const matched = to.matched.find((record) => record.meta['titleKey']);
  const key = matched?.meta['titleKey'] as string | undefined;
  document.title = key ? `Nova Task` : 'Nova Task';
});
