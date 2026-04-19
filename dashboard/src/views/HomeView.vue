<script setup lang="ts">
// node_modules
import { computed, nextTick, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRouter } from 'vue-router';

// components
import GsapModal from '@/components/shared/GsapModal.vue';
import PageShell from '@/components/layout/PageShell.vue';
import TaskDetailModal from '@/components/task/TaskDetailModal.vue';
import TaskRow from '@/components/task/TaskRow.vue';

// composables
import { useRefetchWhenReachable } from '@/composables/useRefetchWhenReachable';

// lib
import { staggerGridItems } from '@/lib/gsap';
import { isDueSoon, isDueToday, isOverdue } from '@/lib/utils';

// stores
import { useAuthStore } from '@/stores/auth';
import { useListsStore } from '@/stores/lists';
import { useTasksStore } from '@/stores/tasks';

// types
import type { List, Task } from '@/@types/index';

// -------------------------------------------------- Store --------------------------------------------------
const tasksStore = useTasksStore();
const listsStore = useListsStore();
const authStore = useAuthStore();
const router = useRouter();
const { t, locale } = useI18n();

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
const listOverviewCards = computed(() =>
  orderedLists.value.map((list) => {
    const tasksInList = tasksStore.tasks.filter((task) => task.listId === list.id && !task.parentTaskId);
    const doneCount = tasksInList.filter((task) => task.done).length;
    const openCount = tasksInList.length - doneCount;
    const totalCount = tasksInList.length;
    const completionPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
    return {
      list,
      openCount,
      completionPct,
      statusLabel: (list.category || t('task.activeTasks')).toUpperCase(),
      description: list.category || t('list.taskCount', { n: totalCount }),
    };
  }),
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
const scheduleTasks = computed(() => {
  const merged = [...overdue.value, ...today.value, ...week.value];
  const uniqueById = new Map<string, Task>();
  for (const task of merged) {
    if (!uniqueById.has(task.id)) {
      uniqueById.set(task.id, task);
    }
  }
  return [...uniqueById.values()].sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    if (da !== db) {
      return da - db;
    }
    return a.title.localeCompare(b.title);
  });
});
const hasScheduleTasks = computed(() => scheduleTasks.value.length > 0);
const greetingName = computed(() => authStore.username || t('nav.home'));
const greetingKey = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'home.greetingMorning';
  }
  if (hour < 18) {
    return 'home.greetingAfternoon';
  }
  return 'home.greetingEvening';
});
const todayDateLabel = computed(() =>
  new Intl.DateTimeFormat(locale.value || undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date()),
);
const withAlpha = (hexColor: string | null, alphaHex: string): string | undefined => {
  if (!hexColor) {
    return undefined;
  }
  const normalized = hexColor.trim();
  if (!/^#([0-9A-Fa-f]{6})$/.test(normalized)) {
    return undefined;
  }
  return `${normalized}${alphaHex}`;
};

/** Home digest is empty when none of the three buckets have items. */
const digestEmpty = computed(
  () => !overdue.value.length && !today.value.length && !week.value.length,
);

const isInHomeDigest = (task: Task): boolean => {
  if (task.parentTaskId || task.done || !task.dueDate) {
    return false;
  }
  if (isOverdue(task.dueDate, false) || isDueToday(task.dueDate)) {
    return true;
  }
  return isDueSoon(task.dueDate, 7);
};

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

const reloadHomeData = async (): Promise<void> => {
  await listsStore.fetchLists();
  await tasksStore.fetchTasks();
};

useRefetchWhenReachable(reloadHomeData);

// -------------------------------------------------- Lifecycle --------------------------------------------------
onMounted(async () => {
  await listsStore.fetchLists();
  await tasksStore.fetchTasks();
  await nextTick();
  staggerGridItems(listsGridRef.value);
});

// -------------------------------------------------- Methods --------------------------------------------------
const listName = (listId: string): string => {
  return listsStore.listById(listId)?.title ?? listId;
};

const goToList = (list: List): void => {
  void router.push({ name: 'list', params: { id: list.id } });
};

const goToFirstList = (): void => {
  const first = orderedLists.value[0];
  if (first) {
    goToList(first);
  }
};

const canEditList = (listId: string): boolean => {
  const list = listsStore.listById(listId);
  if (!list) {
    return false;
  }
  if (!list.isShared) {
    return true;
  }
  return list.sharedPermission === 'WRITE' || list.sharedPermission === 'ADMIN';
};

const canEditActiveTask = computed(() => {
  if (!activeTask.value) {
    return true;
  }
  return canEditList(activeTask.value.listId);
});

const subCount = (task: Task): number => {
  return tasksStore.subTasksOf(task.id).length;
};

const toggle = async (task: Task): Promise<void> => {
  await tasksStore.toggleDone(task.id);
};

const openTask = async (task: Task): Promise<void> => {
  activeTask.value = await tasksStore.fetchTask(task.id);
  bTaskOpen.value = true;
};

const onOpenTaskFromDetail = async (task: Task): Promise<void> => {
  activeTask.value = await tasksStore.fetchTask(task.id);
};

const requestDeleteTask = (task: Task): void => {
  taskPendingDelete.value = task;
  bDeleteConfirm.value = true;
};

const confirmDeleteTask = async (): Promise<void> => {
  if (!taskPendingDelete.value) {
    return;
  }
  await tasksStore.deleteTask(taskPendingDelete.value.id);
  bDeleteConfirm.value = false;
  taskPendingDelete.value = null;
};

const afterTaskModalClose = async (): Promise<void> => {
  await tasksStore.fetchTasks();
};
</script>

<template>
  <PageShell>
    <section class="mb-8 space-y-2">
      <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {{ t('home.workspaceOverview') }}
      </p>
      <h1 class="text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
        {{ t(greetingKey, { name: greetingName }) }}
      </h1>
    </section>
    <section class="mb-8 rounded-3xl border border-border bg-card/30 p-5 md:p-6">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-2xl font-semibold tracking-tight text-text-primary">
          {{ t('home.todaySchedule') }}
        </h2>
        <span class="rounded-full bg-fg/[0.06] px-3 py-1 text-xs font-semibold text-text-muted">
          {{ todayDateLabel }}
        </span>
      </div>
      <div v-if="hasScheduleTasks" class="list-view">
        <div class="list-view-items">
          <div v-for="task in scheduleTasks" :key="task.id" class="space-y-1">
            <div class="px-1 text-[11px] font-medium text-text-muted">
              {{ t('home.listBadge', { name: listName(task.listId) }) }}
            </div>
            <TaskRow
              :task="task"
              :subtask-count="subCount(task)"
              :show-drag-handle="false"
              :can-edit="canEditList(task.listId)"
              @toggle-done="toggle"
              @open="openTask"
              @delete="requestDeleteTask"
            />
          </div>
        </div>
      </div>
      <div
        v-else
        class="mt-2 rounded-2xl border border-primary/25 bg-card px-6 py-10 text-center shadow-sm"
      >
        <h3 class="mb-2 text-xl font-semibold tracking-tight text-text-primary">
          {{ t(emptyCardCopy.titleKey) }}
        </h3>
        <p class="mb-6 text-sm leading-relaxed text-text-muted">
          {{ t(emptyCardCopy.bodyKey, emptyCardCopy.params) }}
        </p>
        <div
          v-if="orderedLists.length"
          class="flex flex-col items-stretch justify-center gap-2 sm:flex-row"
        >
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
      </div>
    </section>
    <section v-if="listOverviewCards.length" class="mb-8">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
        {{ t('home.yourLists') }}
      </h2>
      <div ref="listsGridRef" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <button
          v-for="card in listOverviewCards"
          :key="card.list.id"
          type="button"
          class="rounded-2xl border border-border bg-card/50 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          @click="goToList(card.list)"
        >
          <div class="mb-5 flex items-start justify-between gap-3">
            <div
              class="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary"
              :style="{
                backgroundColor: withAlpha(card.list.color, '22'),
                color: card.list.color || undefined,
              }"
            >
              <span class="material-icons text-xl leading-none">
                {{ card.list.icon || 'folder' }}
              </span>
            </div>
            <span class="rounded-md bg-fg/[0.06] px-2 py-0.5 text-[10px] font-semibold text-text-muted">
              {{ card.statusLabel }}
            </span>
          </div>
          <h3 class="text-xl font-semibold text-text-primary">{{ card.list.title }}</h3>
          <p class="mt-1 text-sm text-text-muted">
            {{ card.description }}
          </p>
          <div class="mt-5 space-y-2">
            <div class="flex items-center justify-between text-xs font-semibold text-text-muted">
              <span>{{ t('task.itemsRemaining', { n: card.openCount }) }}</span>
              <span>{{ card.completionPct }}%</span>
            </div>
            <div class="h-1.5 rounded-full bg-border/70">
              <div
                class="h-full rounded-full bg-primary transition-all"
                :style="{ width: `${card.completionPct}%` }"
              />
            </div>
          </div>
        </button>
      </div>
    </section>
    <TaskDetailModal
      :is-open="bTaskOpen"
      :task="activeTask"
      :can-edit="canEditActiveTask"
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
