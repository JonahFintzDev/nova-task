<script setup lang="ts">
// node_modules
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterView, useRoute } from 'vue-router';

// lib
import { pageEnter, pageLeave } from '@/lib/gsap';

// components
import ApiOfflineBanner from '@/components/shared/ApiOfflineBanner.vue';
import GlobalSearchModal from '@/components/shared/GlobalSearchModal.vue';
import NavSidebar from '@/components/layout/NavSidebar.vue';
import NavTopBar from '@/components/layout/NavTopBar.vue';
import TaskDetailModal from '@/components/task/TaskDetailModal.vue';

// stores
import { useTasksStore } from '@/stores/tasks';

// types
import type { Task } from '@/@types/index';

// -------------------------------------------------- Data --------------------------------------------------

const route = useRoute();
const tasksStore = useTasksStore();
const { t } = useI18n();
const bSearchOpen = ref(false);
const navSidebarRef = ref<{ openDrawer: () => void } | null>(null);
const searchTask = ref<Task | null>(null);
const bTaskModalOpen = ref(false);

// -------------------------------------------------- Computed --------------------------------------------------

const pageTitle = computed(() => {
  const name = route.name;
  if (name === 'home') {
    return t('nav.home');
  }
  if (name === 'all-tasks') {
    return t('nav.allTasks');
  }
  if (name === 'settings') {
    return t('settings.title');
  }
  if (name === 'admin') {
    return t('admin.title');
  }
  if (name === 'list') {
    return t('nav.lists');
  }
  return 'Nova Task';
});

// -------------------------------------------------- Methods --------------------------------------------------

function openNavDrawer(): void {
  navSidebarRef.value?.openDrawer();
}

function onGlobalKey(event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    bSearchOpen.value = true;
  }
}

async function onSearchTask(task: Task): Promise<void> {
  searchTask.value = await tasksStore.fetchTask(task.id);
  bTaskModalOpen.value = true;
}

async function onSearchOpenNestedTask(task: Task): Promise<void> {
  searchTask.value = await tasksStore.fetchTask(task.id);
}

// -------------------------------------------------- Lifecycle --------------------------------------------------

onMounted(() => {
  window.addEventListener('keydown', onGlobalKey);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKey);
});
</script>

<template>
  <div class="app-shell relative z-10 flex bg-bg text-text-primary">
    <NavSidebar ref="navSidebarRef" />
    <div class="flex min-w-0 flex-1 flex-col lg:ms-0">
      <ApiOfflineBanner />
      <NavTopBar :title="pageTitle" @search="bSearchOpen = true" @menu="openNavDrawer" />
      <main class="min-h-0 flex-1 overflow-y-auto">
        <RouterView v-slot="{ Component }">
          <Transition mode="out-in" :css="false" @enter="pageEnter" @leave="pageLeave">
            <component :is="Component" :key="route.fullPath" />
          </Transition>
        </RouterView>
      </main>
    </div>
    <GlobalSearchModal
      :is-open="bSearchOpen"
      @close="bSearchOpen = false"
      @open-task="onSearchTask"
    />
    <TaskDetailModal
      :is-open="bTaskModalOpen"
      :task="searchTask"
      @close="
        bTaskModalOpen = false;
        searchTask = null;
      "
      @saved="
        bTaskModalOpen = false;
        searchTask = null;
      "
      @open-task="onSearchOpenNestedTask"
    />
  </div>
</template>
