<script setup lang="ts">
// node_modules
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

// components
import GsapModal from '@/components/shared/GsapModal.vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import PageShell from '@/components/layout/PageShell.vue';
import PriorityBadge from '@/components/task/PriorityBadge.vue';
import TaskCard from '@/components/task/TaskCard.vue';
import TaskDetailModal from '@/components/task/TaskDetailModal.vue';

import { useDataTheme } from '@/composables/useDataTheme';
import { tagPillStyles } from '@/lib/tagColors';

// stores
import { useListsStore } from '@/stores/lists';
import { useTagsStore } from '@/stores/tags';
import { useTasksStore } from '@/stores/tasks';

// types
import type { Priority, Tag, Task } from '@/@types/index';

// -------------------------------------------------- Store --------------------------------------------------

const tasksStore = useTasksStore();
const listsStore = useListsStore();
const tagsStore = useTagsStore();
const { t } = useI18n();

// -------------------------------------------------- Data --------------------------------------------------

const PRIORITY_LEGEND: readonly Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const filterTagIds = ref<string[]>([]);
const themeMode = useDataTheme();
const bTaskOpen = ref(false);
const activeTask = ref<Task | null>(null);
const bDeleteConfirm = ref(false);
const taskPendingDelete = ref<Task | null>(null);

// -------------------------------------------------- Computed --------------------------------------------------

const grouped = computed(() => {
  const map = new Map<string, Task[]>();
  for (const task of tasksStore.tasks) {
    if (task.parentTaskId) {
      continue;
    }
    if (filterTagIds.value.length) {
      const ids = new Set(task.tags.map((tag) => tag.id));
      if (!filterTagIds.value.every((id) => ids.has(id))) {
        continue;
      }
    }
    if (!map.has(task.listId)) {
      map.set(task.listId, []);
    }
    map.get(task.listId)!.push(task);
  }
  return map;
});

// -------------------------------------------------- Lifecycle --------------------------------------------------

onMounted(async () => {
  await listsStore.fetchLists();
  await tasksStore.fetchTasks();
  await tagsStore.fetchTags();
});

// -------------------------------------------------- Methods --------------------------------------------------

function listTitle(id: string): string {
  return listsStore.listById(id)?.title ?? id;
}

function filterTagStyle(tag: Tag): Record<string, string> {
  const base = tagPillStyles(tag, themeMode.value);
  if (filterTagIds.value.includes(tag.id)) {
    return { ...base, boxShadow: '0 0 0 2px var(--color-primary)' };
  }
  return base;
}

function toggleTagFilter(tagId: string): void {
  if (filterTagIds.value.includes(tagId)) {
    filterTagIds.value = filterTagIds.value.filter((id) => id !== tagId);
  } else {
    filterTagIds.value = [...filterTagIds.value, tagId];
  }
}

async function toggle(task: Task): Promise<void> {
  await tasksStore.toggleDone(task.id);
}

function subCount(task: Task): number {
  return tasksStore.subTasksOf(task.id).length;
}

async function openTask(task: Task): Promise<void> {
  activeTask.value = await tasksStore.fetchTask(task.id);
  bTaskOpen.value = true;
}

async function onOpenTaskFromDetail(task: Task): Promise<void> {
  activeTask.value = await tasksStore.fetchTask(task.id);
}

function requestDeleteTask(task: Task): void {
  taskPendingDelete.value = task;
  bDeleteConfirm.value = true;
}

async function confirmDeleteTask(): Promise<void> {
  if (!taskPendingDelete.value) {
    return;
  }
  await tasksStore.deleteTask(taskPendingDelete.value.id);
  bDeleteConfirm.value = false;
  taskPendingDelete.value = null;
}

async function afterTaskModalClose(): Promise<void> {
  await tasksStore.fetchTasks();
}
</script>

<template>
  <PageShell>
    <PageHeader :title="t('nav.allTasks')" />
    <div class="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-border bg-card/20 p-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          {{ t('task.priority') }}
        </span>
        <div class="flex flex-wrap gap-1">
          <PriorityBadge v-for="p in PRIORITY_LEGEND" :key="p" :priority="p" />
        </div>
      </div>
      <button
        v-for="tag in tagsStore.tags"
        :key="tag.id"
        type="button"
        class="rounded-full border px-2 py-0.5 text-xs transition-shadow"
        :style="filterTagStyle(tag)"
        @click="toggleTagFilter(tag.id)"
      >
        {{ tag.name }}
      </button>
    </div>
    <div v-for="[listIdKey, tasks] in [...grouped.entries()]" :key="listIdKey" class="mb-8">
      <h2 class="mb-2 text-sm font-semibold text-text-muted">{{ listTitle(listIdKey) }}</h2>
      <div class="grid-view">
        <div class="grid-view-items">
          <TaskCard
            v-for="task in tasks"
            :key="task.id"
            :task="task"
            :subtask-count="subCount(task)"
            @toggle-done="toggle"
            @open="openTask"
            @delete="requestDeleteTask"
          />
        </div>
      </div>
    </div>
    <TaskDetailModal
      :is-open="bTaskOpen"
      :task="activeTask"
      @close="bTaskOpen = false"
      @saved="
        bTaskOpen = false;
        afterTaskModalClose();
      "
      @open-task="onOpenTaskFromDetail"
    />
    <GsapModal :show="bDeleteConfirm">
      <div
        class="modal-backdrop"
        @click="
          bDeleteConfirm = false;
          taskPendingDelete = null;
        "
      />
      <div class="modal-panel max-w-sm">
        <div class="modal-body">{{ t('task.confirmDelete') }}</div>
        <div class="modal-footer">
          <button
            type="button"
            class="button"
            @click="
              bDeleteConfirm = false;
              taskPendingDelete = null;
            "
          >
            {{ t('common.cancel') }}
          </button>
          <button type="button" class="button is-destructive" @click="confirmDeleteTask">
            {{ t('common.confirm') }}
          </button>
        </div>
      </div>
    </GsapModal>
  </PageShell>
</template>
