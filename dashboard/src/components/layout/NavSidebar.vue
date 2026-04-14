<script setup lang="ts">
// node_modules
import { LayoutDashboard, Plus, Settings, Shield } from 'lucide-vue-next';
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute } from 'vue-router';

// components
import ListEditModal from '@/components/list/ListEditModal.vue';

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

function categoryKey(list: List): string {
  return list.category?.trim() || '__uncat__';
}

function categoryLabelFor(list: List): string {
  const key = categoryKey(list);
  return key === '__uncat__' ? t('list.uncategorized') : key;
}

function showCategoryHeading(list: List): boolean {
  const index = orderedLists.value.findIndex((entry) => entry.id === list.id);
  if (index <= 0) {
    return true;
  }
  const previous = orderedLists.value[index - 1];
  if (!previous) {
    return true;
  }
  return categoryKey(list) !== categoryKey(previous);
}

function isFirstList(list: List): boolean {
  return orderedLists.value.findIndex((entry) => entry.id === list.id) === 0;
}

function isListActive(list: List): boolean {
  return route.name === 'list' && route.params['id'] === list.id;
}

function openDrawer(): void {
  bOpen.value = true;
}

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
      >
        <span class="flex items-center gap-2 font-bold text-text-primary leading-tight">
          <LayoutDashboard class="h-4 w-4 shrink-0 text-primary" />
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
      >
        <LayoutDashboard class="h-5 w-5 shrink-0" />
        {{ t('nav.home') }}
      </RouterLink>
      <div class="min-h-0">
        <template v-for="list in orderedLists" :key="list.id">
          <div>
            <div
              v-if="showCategoryHeading(list)"
              class="px-3 py-1 text-xs text-text-muted"
              :class="isFirstList(list) ? '' : 'mt-3'"
            >
              {{ categoryLabelFor(list) }}
            </div>
            <RouterLink
              :to="{ name: 'list', params: { id: list.id } }"
              class="mt-1 flex min-h-[40px] min-w-0 items-center gap-2.5 rounded-lg py-1.5 ps-3 pe-3 text-sm font-medium"
              :class="
                isListActive(list)
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-muted hover:bg-fg/[0.05] hover:text-text-primary'
              "
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
        @click="bAddListModal = true"
      >
        <Plus class="h-5 w-5 shrink-0 opacity-80" />
        {{ t('list.addList') }}
      </button>
    </div>
    <div class="border-t border-border p-2">
      <RouterLink
        to="/settings"
        class="flex min-h-[40px] items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-text-muted hover:bg-fg/[0.05] hover:text-text-primary"
      >
        <Settings class="h-5 w-5 shrink-0" />
        {{ t('nav.settings') }}
      </RouterLink>
      <RouterLink
        v-if="authStore.isAdmin"
        to="/admin"
        class="flex min-h-[40px] items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-text-muted hover:bg-fg/[0.05] hover:text-text-primary"
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
