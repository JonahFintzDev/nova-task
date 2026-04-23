<script setup lang="ts">
// node_modules
import { LayoutDashboard, Plus, Settings, Shield } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute } from 'vue-router';

// components
import ListEditModal from '@/components/list/ListEditModal.vue';

// lib
import { routeParamToString } from '@/lib/utils';

// stores
import { useAuthStore } from '@/stores/auth';
import { useListsStore } from '@/stores/lists';

// types
import type { List } from '@/@types/index';

// -------------------------------------------------- Store --------------------------------------------------
const listsStore = useListsStore();
const authStore = useAuthStore();
const route = useRoute();
const { t } = useI18n();

// -------------------------------------------------- Data --------------------------------------------------
const bOpen = ref(false);
const bAddListModal = ref(false);
const orderedLists = ref<List[]>([]);

// -------------------------------------------------- Watchers --------------------------------------------------
watch(
  () => listsStore.lists,
  (lists) => {
    orderedLists.value = [...lists].sort((a, b) => a.sortOrder - b.sortOrder);
  },
  { immediate: true, deep: true },
);

// -------------------------------------------------- Lifecycle --------------------------------------------------
onMounted(() => {
  void listsStore.fetchLists();
});

// -------------------------------------------------- Methods --------------------------------------------------
const categoryKey = (list: List): string => {
  return list.category?.trim() || '__uncat__';
};

const categoryLabelForKey = (key: string): string => {
  return key === '__uncat__' ? t('list.uncategorized') : key;
};

/** One heading per category; category order follows earliest list sortOrder in that category. */
const categorySections = computed(() => {
  const byKey = new Map<string, List[]>();
  const minOrder = new Map<string, number>();

  for (const list of orderedLists.value) {
    const key = categoryKey(list);
    const bucket = byKey.get(key);
    if (!bucket) {
      byKey.set(key, [list]);
      minOrder.set(key, list.sortOrder);
    } else {
      bucket.push(list);
      minOrder.set(key, Math.min(minOrder.get(key)!, list.sortOrder));
    }
  }

  const keys = [...byKey.keys()].sort((a, b) => {
    const ao = minOrder.get(a) ?? 0;
    const bo = minOrder.get(b) ?? 0;
    if (ao !== bo) {
      return ao - bo;
    }
    return a.localeCompare(b);
  });

  return keys.map((key) => ({
    key,
    label: categoryLabelForKey(key),
    lists: byKey.get(key)!,
  }));
});

const isListActive = (list: List): boolean => {
  return route.name === 'list' && routeParamToString(route.params['id']) === list.id;
};

const openDrawer = (): void => {
  bOpen.value = true;
};

/** Collapse the mobile drawer after choosing a destination (no-op on lg where the rail is always visible). */
const closeMobileDrawer = (): void => {
  bOpen.value = false;
};

defineExpose({ openDrawer });
</script>

<template>
  <aside
    class="flex h-full w-64 shrink-0 flex-col border-r max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:transition-transform lg:static lg:z-auto lg:translate-x-0"
    :class="[bOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full', 'border-border bg-surface']"
  >
    <div
      class="flex h-14 shrink-0 items-center justify-between border-b border-border px-4"
    >
      <RouterLink
        to="/"
        class="flex min-h-0 min-w-0 flex-col gap-0 rounded-md px-2 py-1.5 hover:bg-fg/[0.05]"
        @click="closeMobileDrawer"
      >
        <span class="flex items-center gap-2 font-bold text-text-primary leading-tight">
          <img src="/icon.svg" class="h-5 w-5 shrink-0" alt="" aria-hidden="true" />
          Nova Task
        </span>
        <span class="ps-6 text-[11px] text-text-muted leading-tight">Task Manager</span>
      </RouterLink>
      <button
        type="button"
        class="button is-icon is-transparent lg:!hidden"
        @click="bOpen = false"
      >
        ×
      </button>
    </div>
    <div class="flex-1 overflow-y-auto px-2 py-3">
      <RouterLink
        to="/"
        class="mb-3 flex min-h-[40px] items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium"
        :class="route.name === 'home' ? 'bg-primary/10 text-primary' : 'text-text-muted hover:bg-fg/[0.05] hover:text-text-primary'"
        @click="closeMobileDrawer"
      >
        <LayoutDashboard class="h-5 w-5 shrink-0" />
        {{ t('nav.home') }}
      </RouterLink>
      <div class="min-h-0">
        <template v-for="(section, si) in categorySections" :key="section.key">
          <div>
            <div
              class="px-3 py-1 text-xs text-text-muted"
              :class="si === 0 ? '' : 'mt-3'"
            >
              {{ section.label }}
            </div>
            <RouterLink
              v-for="list in section.lists"
              :key="list.id"
              :to="{ name: 'list', params: { id: list.id } }"
              class="mt-1 flex min-h-[40px] min-w-0 items-center gap-2.5 rounded-lg py-1.5 ps-3 pe-3 text-sm font-medium"
              :class="
                isListActive(list)
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-muted hover:bg-fg/[0.05] hover:text-text-primary'
              "
              @click="closeMobileDrawer"
            >
              <span
                v-if="list.icon"
                class="material-icons inline-flex h-5 w-5 shrink-0 items-center justify-center text-lg opacity-80"
                :style="list.color ? { color: list.color } : undefined"
              >
                {{ list.icon }}
              </span>
              <span
                v-else
                class="inline-flex h-5 w-5 shrink-0 items-center justify-center"
              >
                <span
                  class="inline-block h-2 w-2 rounded-full"
                :class="list.color ? '' : isListActive(list) ? 'bg-primary' : 'bg-text-muted/50'"
                :style="list.color ? { background: list.color } : undefined"
                aria-hidden="true"
                />
              </span>
              <span class="min-w-0 flex-1 truncate">{{ list.title }}</span>
              <span
                v-if="list.activeCount != null || list.taskCount != null"
                class="shrink-0 tabular-nums text-[10px] text-text-muted"
              >
                {{ list.activeCount ?? (list.taskCount ?? 0) - (list.doneCount ?? 0) }}
              </span>
            </RouterLink>
          </div>
        </template>
      </div>
      <button
        type="button"
        class="button is-transparent mt-2 flex h-10 min-h-[40px] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 text-sm text-text-muted hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        @click="
          closeMobileDrawer();
          bAddListModal = true;
        "
      >
        <Plus class="h-5 w-5 shrink-0 opacity-80" />
        {{ t('list.addList') }}
      </button>
    </div>
    <div class="border-t border-border p-2">
      <RouterLink
        to="/settings"
        class="flex min-h-[40px] items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-text-muted hover:bg-fg/[0.05] hover:text-text-primary"
        @click="closeMobileDrawer"
      >
        <Settings class="h-5 w-5 shrink-0" />
        {{ t('nav.settings') }}
      </RouterLink>
      <RouterLink
        v-if="authStore.isAdmin"
        to="/admin"
        class="flex min-h-[40px] items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-text-muted hover:bg-fg/[0.05] hover:text-text-primary"
        @click="closeMobileDrawer"
      >
        <Shield class="h-5 w-5 shrink-0" />
        {{ t('nav.admin') }}
      </RouterLink>
    </div>
  </aside>
  <div
    v-if="bOpen"
    class="fixed inset-0 z-30 bg-black/50 lg:hidden"
    @click="bOpen = false"
  />
  <ListEditModal
    :is-open="bAddListModal"
    @close="bAddListModal = false"
    @saved="bAddListModal = false"
  />
</template>
