<script setup lang="ts">
// node_modules
import { Sparkles } from 'lucide-vue-next';
import { computed, nextTick, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRouter } from 'vue-router';

// components
import GsapModal from '@/components/shared/GsapModal.vue';
import ListCard from '@/components/list/ListCard.vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import PageShell from '@/components/layout/PageShell.vue';
import TaskDetailModal from '@/components/task/TaskDetailModal.vue';
import TaskRow from '@/components/task/TaskRow.vue';

// lib
import { staggerGridItems } from '@/lib/gsap';
import { isDueSoon, isDueToday, isOverdue } from '@/lib/utils';

// stores
import { useListsStore } from '@/stores/lists';
import { useTasksStore } from '@/stores/tasks';

// types
import type { List, Task } from '@/@types/index';

// -------------------------------------------------- Store --------------------------------------------------

const tasksStore = useTasksStore();
const listsStore = useListsStore();
const router = useRouter();
const { t } = useI18n();

// -------------------------------------------------- Data --------------------------------------------------

const bTaskOpen = ref(false);
const activeTask = ref<Task | null>(null);
const bDeleteConfirm = ref(false);
const taskPendingDelete = ref<Task | null>(null);
const listsGridRef = ref<HTMLElement | null>(null);

// -------------------------------------------------- Computed --------------------------------------------------

const orderedLists = computed(() =>
  [...listsStore.lists].sort((a, b) => a.sortOrder - b.sortOrder),
);

const overdue = computed(() => {
  return [...tasksStore.overdueTasks].sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    return da - db;
  });
});

const today = computed(() => tasksStore.dueTodayTasks());

const week = computed(() => tasksStore.dueThisWeekTasks());

/** Home digest is empty when none of the three buckets have items. */
const digestEmpty = computed(
  () => !overdue.value.length && !today.value.length && !week.value.length,
);

function isInHomeDigest(task: Task): boolean {
  if (task.parentTaskId || task.done || !task.dueDate) {
    return false;
  }
  if (isOverdue(task.dueDate, false) || isDueToday(task.dueDate)) {
    return true;
  }
  return isDueSoon(task.dueDate, 7);
}

/** Open root tasks with a due date outside overdue / today / next-7-days (same rules as the three Home sections). */
const tasksDueAfterDigestWindow = computed(() => {
  return tasksStore.tasks.filter(
    (task) => !task.parentTaskId && !task.done && task.dueDate && !isInHomeDigest(task),
  );
});

const activeRootUndated = computed(() =>
  tasksStore.tasks.filter((task) => !task.parentTaskId && !task.done && !task.dueDate),
);

type DigestEmptyKind = 'clear' | 'later' | 'undated' | 'mixed';

const digestEmptyKind = computed((): DigestEmptyKind => {
  if (!digestEmpty.value) {
    return 'clear';
  }
  const laterN = tasksDueAfterDigestWindow.value.length;
  const undatedN = activeRootUndated.value.length;
  if (laterN > 0 && undatedN > 0) {
    return 'mixed';
  }
  if (laterN > 0) {
    return 'later';
  }
  if (undatedN > 0) {
    return 'undated';
  }
  return 'clear';
});

const emptyCardCopy = computed(() => {
  const kind = digestEmptyKind.value;
  const laterN = tasksDueAfterDigestWindow.value.length;
  const undatedN = activeRootUndated.value.length;
  if (kind === 'later') {
    return { titleKey: 'home.emptyTitleLater', bodyKey: 'home.emptySubtitleLater', params: { n: laterN } };
  }
  if (kind === 'undated') {
    return { titleKey: 'home.emptyTitleUndated', bodyKey: 'home.emptySubtitleUndated', params: {} };
  }
  if (kind === 'mixed') {
    return {
      titleKey: 'home.emptyTitleMixed',
      bodyKey: 'home.emptySubtitleMixed',
      params: { n: laterN, m: undatedN },
    };
  }
  return { titleKey: 'home.emptyTitle', bodyKey: 'home.emptySubtitleClear', params: {} };
});

// -------------------------------------------------- Lifecycle --------------------------------------------------

onMounted(async () => {
  await listsStore.fetchLists();
  await tasksStore.fetchTasks();
  await nextTick();
  staggerGridItems(listsGridRef.value);
});

// -------------------------------------------------- Methods --------------------------------------------------

function listName(listId: string): string {
  return listsStore.listById(listId)?.title ?? listId;
}

function goToList(list: List): void {
  void router.push({ name: 'list', params: { id: list.id } });
}

function goToFirstList(): void {
  const first = orderedLists.value[0];
  if (first) {
    goToList(first);
  }
}

async function toggle(task: Task): Promise<void> {
  await tasksStore.toggleDone(task.id);
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
    <PageHeader :title="t('nav.home')" />
    <section v-if="orderedLists.length" class="grid-view mb-10">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
        {{ t('home.yourLists') }}
      </h2>
      <div ref="listsGridRef" class="grid-view-items">
        <ListCard v-for="list in orderedLists" :key="list.id" :list="list" @click="goToList" />
      </div>
    </section>
    <section
      v-if="digestEmpty"
      class="mx-auto mt-1 max-w-lg rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/[0.12] via-card/40 to-card/20 px-6 py-10 text-center shadow-sm"
    >
      <div
        class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-primary ring-2 ring-primary/30"
        aria-hidden="true"
      >
        <Sparkles class="h-8 w-8" :stroke-width="1.75" />
      </div>
      <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary/90">
        {{ t('home.emptyScopeLabel') }}
      </p>
      <p class="mb-5 text-xs leading-snug text-text-muted">
        {{ t('home.emptyScopeDetail') }}
      </p>
      <h2 class="mb-2 text-xl font-semibold tracking-tight text-text-primary">
        {{ t(emptyCardCopy.titleKey) }}
      </h2>
      <p class="mb-6 text-sm leading-relaxed text-text-muted">
        {{ t(emptyCardCopy.bodyKey, emptyCardCopy.params) }}
      </p>
      <div v-if="orderedLists.length" class="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
        <button type="button" class="button is-primary min-h-10 px-5" @click="goToFirstList">
          {{ t('home.emptyCtaPrimary') }}
        </button>
        <RouterLink
          :to="{ name: 'all-tasks' }"
          class="button is-transparent min-h-10 justify-center border-border/80"
        >
          {{ t('home.emptyCtaSecondary') }}
        </RouterLink>
      </div>
      <p v-else class="text-sm font-medium leading-relaxed text-primary">
        {{ t('home.emptyNoListsHint') }}
      </p>
    </section>
    <div v-else class="space-y-8">
      <section v-if="overdue.length">
        <h2 class="mb-3 text-sm font-semibold uppercase text-destructive">{{ t('home.overdue') }}</h2>
        <div class="list-view">
          <div class="list-view-items">
            <div v-for="task in overdue" :key="task.id" class="px-2">
              <div class="mb-1 text-[10px] text-text-muted">
                {{ t('home.listBadge', { name: listName(task.listId) }) }}
              </div>
              <TaskRow
                :task="task"
                @toggle-done="toggle"
                @open="openTask"
                @delete="requestDeleteTask"
              />
            </div>
          </div>
        </div>
      </section>
      <section v-if="today.length">
        <h2 class="mb-3 text-sm font-semibold uppercase text-warning">{{ t('home.dueToday') }}</h2>
        <div class="list-view">
          <div class="list-view-items">
            <div v-for="task in today" :key="task.id" class="px-2">
              <div class="mb-1 text-[10px] text-text-muted">
                {{ t('home.listBadge', { name: listName(task.listId) }) }}
              </div>
              <TaskRow
                :task="task"
                @toggle-done="toggle"
                @open="openTask"
                @delete="requestDeleteTask"
              />
            </div>
          </div>
        </div>
      </section>
      <section v-if="week.length">
        <h2 class="mb-3 text-sm font-semibold uppercase text-text-muted">{{ t('home.dueWeek') }}</h2>
        <div class="list-view">
          <div class="list-view-items">
            <div v-for="task in week" :key="task.id" class="px-2">
              <div class="mb-1 text-[10px] text-text-muted">
                {{ t('home.listBadge', { name: listName(task.listId) }) }}
              </div>
              <TaskRow
                :task="task"
                @toggle-done="toggle"
                @open="openTask"
                @delete="requestDeleteTask"
              />
            </div>
          </div>
        </div>
      </section>
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
