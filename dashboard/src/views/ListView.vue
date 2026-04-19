<script setup lang="ts">
// node_modules
import draggable from 'vuedraggable';
import { CalendarClock, CheckCircle2, ChevronDown, Flag, History, MoreVertical, Plus, Sparkles, Tags } from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

// components
import ListEditModal from '@/components/list/ListEditModal.vue';
import ListShareModal from '@/components/ListShareModal.vue';
import AiSuggestBox from '@/components/task/AiSuggestBox.vue';
import ButtonMultiselect from '@/components/shared/ButtonMultiselect.vue';
import ConfirmModal from '@/components/shared/ConfirmModal.vue';
import DateTimePicker from '@/components/shared/DateTimePicker.vue';
import GsapModal from '@/components/shared/GsapModal.vue';
import PageShell from '@/components/layout/PageShell.vue';
import TagChipsInput from '@/components/shared/TagChipsInput.vue';
import TaskDetailModal from '@/components/task/TaskDetailModal.vue';
import TaskRow from '@/components/task/TaskRow.vue';

// composables
import { useRefetchWhenReachable } from '@/composables/useRefetchWhenReachable';

// lib
import { routeParamToString } from '@/lib/utils';

// stores
import { useListsStore } from '@/stores/lists';
import { useTagsStore } from '@/stores/tags';
import { useTasksStore } from '@/stores/tasks';

// types
import type { Priority, Task } from '@/@types/index';

// -------------------------------------------------- Store --------------------------------------------------
const route = useRoute();
const router = useRouter();
const listsStore = useListsStore();
const tagsStore = useTagsStore();
const tasksStore = useTasksStore();
const { t } = useI18n();

// -------------------------------------------------- Data --------------------------------------------------
const newTitle = ref('');
const groupMode = ref<'none' | 'date' | 'priority'>('none');
const bListModal = ref(false);
const bListMenuOpen = ref(false);
const listMenuRoot = ref<HTMLElement | null>(null);
const bListDeleteConfirm = ref(false);
const bShareModal = ref(false);
const bTaskOpen = ref(false);
const activeTask = ref<Task | null>(null);
const modalInitialTitle = ref('');
const bCompletedOpen = ref(false);
const bAiOpen = ref(false);
const bClearConfirm = ref(false);
const bDeleteConfirm = ref(false);
const taskPendingDelete = ref<Task | null>(null);
const draggableList = ref<Task[]>([]);
const COMPLETED_OPEN_STORAGE_KEY = 'nova-task:completed-open-by-list';
const AI_OPEN_STORAGE_KEY = 'nova-task:ai-open-by-list';
const newPriority = ref<Priority>('NONE');
const newTagIds = ref<string[]>([]);
const newDueDate = ref<Date | null>(null);
const newDueDateHasTime = ref(false);
const activePicker = ref<'priority' | 'tags' | 'duedate' | null>(null);
const composerRef = ref<HTMLElement | null>(null);
const PRIORITIES: readonly Priority[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const activeTaskQuery = computed(() => {
  const rawTaskId = route.query['task'];
  return typeof rawTaskId === 'string' && rawTaskId ? rawTaskId : null;
});
const bSyncingTaskQuery = ref(false);

// -------------------------------------------------- Computed --------------------------------------------------
const listId = computed(() => routeParamToString(route.params['id']));

const list = computed(() => listsStore.listById(listId.value));
const canEditCurrentList = computed(() => {
  if (!list.value) {
    return false;
  }
  if (!list.value.isShared) {
    return true;
  }
  return (
    list.value.sharedPermission === 'WRITE' || list.value.sharedPermission === 'ADMIN'
  );
});
const isListOwner = computed(() => !!list.value && !list.value.isShared);

const rawTopActive = computed(() => tasksStore.activeTasks(listId.value));

const rawTopDone = computed(() => tasksStore.doneTasks(listId.value));

const sortedDone = computed(() => {
  const tasks = [...rawTopDone.value];
  tasks.sort((a, b) => {
    const ta = a.doneAt ? new Date(a.doneAt).getTime() : 0;
    const tb = b.doneAt ? new Date(b.doneAt).getTime() : 0;
    return tb - ta;
  });
  return tasks;
});

const sortedActive = computed(() => {
  const tasks = [...rawTopActive.value];
  tasks.sort((a, b) => a.sortOrder - b.sortOrder);
  return tasks;
});

type TaskGroup = {
  key: string;
  label: string;
  tasks: Task[];
};

const priorityOrder: readonly Task['priority'][] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];

const startOfDay = (value: Date): Date => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfWeekMonday = (value: Date): Date => {
  const d = startOfDay(value);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  return d;
};

const dateGroupForTask = (task: Task): { key: string; label: string; order: number } => {
  if (!task.dueDate) {
    return { key: 'no-date', label: t('task.groupNoDate'), order: 99 };
  }

  const due = new Date(task.dueDate);
  const dueDay = startOfDay(due);
  const today = startOfDay(new Date());
  const msPerDay = 24 * 60 * 60 * 1000;
  const dayDiff = Math.floor((dueDay.getTime() - today.getTime()) / msPerDay);

  if (dayDiff < 0) {
    return { key: 'overdue', label: t('task.overdue'), order: 0 };
  }
  if (dayDiff === 0) {
    return { key: 'today', label: t('home.dueToday'), order: 1 };
  }
  if (dayDiff === 1) {
    return { key: 'tomorrow', label: t('task.groupTomorrow'), order: 2 };
  }

  const thisWeekStart = startOfWeekMonday(today);
  const nextWeekStart = new Date(thisWeekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  const weekAfterNextStart = new Date(nextWeekStart);
  weekAfterNextStart.setDate(weekAfterNextStart.getDate() + 7);

  if (dueDay >= nextWeekStart && dueDay < weekAfterNextStart) {
    return { key: 'next-week', label: t('task.groupNextWeek'), order: 4 };
  }
  if (dueDay >= today && dueDay < nextWeekStart) {
    return { key: 'this-week', label: t('task.groupThisWeek'), order: 3 };
  }

  const thisMonth = today.getMonth();
  const thisYear = today.getFullYear();
  const dueMonth = dueDay.getMonth();
  const dueYear = dueDay.getFullYear();

  if (dueYear === thisYear && dueMonth === thisMonth) {
    return { key: 'this-month', label: t('task.groupThisMonth'), order: 5 };
  }

  if (dueYear === thisYear && dueMonth === thisMonth + 1) {
    return { key: 'next-month', label: t('task.groupNextMonth'), order: 6 };
  }
  if (thisMonth === 11 && dueYear === thisYear + 1 && dueMonth === 0) {
    return { key: 'next-month', label: t('task.groupNextMonth'), order: 6 };
  }

  if (dueYear === thisYear) {
    return { key: 'this-year', label: t('task.groupThisYear'), order: 7 };
  }
  if (dueYear === thisYear + 1) {
    return { key: 'next-year', label: t('task.groupNextYear'), order: 8 };
  }

  return { key: 'later', label: t('task.groupLater'), order: 9 };
};

const groupedActive = computed<TaskGroup[]>(() => {
  const tasks = sortedActive.value;
  if (!tasks.length) {
    return [];
  }

  if (groupMode.value === 'none') {
    return [{ key: 'all', label: t('task.groupNone'), tasks }];
  }

  if (groupMode.value === 'priority') {
    const labels: Record<Task['priority'], string> = {
      URGENT: t('priority.urgent'),
      HIGH: t('priority.high'),
      MEDIUM: t('priority.medium'),
      LOW: t('priority.low'),
      NONE: t('priority.none'),
    };

    const byPriority = new Map<Task['priority'], Task[]>();
    for (const task of tasks) {
      if (!byPriority.has(task.priority)) {
        byPriority.set(task.priority, []);
      }
      byPriority.get(task.priority)!.push(task);
    }

    return priorityOrder
      .map((priority) => {
        const bucket = byPriority.get(priority) ?? [];
        bucket.sort((a, b) => {
          const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          if (da !== db) {
            return da - db;
          }
          return a.sortOrder - b.sortOrder;
        });
        return {
          key: `priority-${priority.toLowerCase()}`,
          label: labels[priority],
          tasks: bucket,
        };
      })
      .filter((group) => group.tasks.length > 0);
  }

  const byDate = new Map<string, { label: string; order: number; tasks: Task[] }>();
  for (const task of tasks) {
    const group = dateGroupForTask(task);
    if (!byDate.has(group.key)) {
      byDate.set(group.key, { label: group.label, order: group.order, tasks: [] });
    }
    byDate.get(group.key)!.tasks.push(task);
  }

  return [...byDate.entries()]
    .map(([key, group]) => {
      group.tasks.sort((a, b) => {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        if (da !== db) {
          return da - db;
        }
        const pa = priorityOrder.indexOf(a.priority);
        const pb = priorityOrder.indexOf(b.priority);
        if (pa !== pb) {
          return pa - pb;
        }
        return a.sortOrder - b.sortOrder;
      });
      return {
        key,
        label: group.label,
        order: group.order,
        tasks: group.tasks,
      };
    })
    .sort((a, b) => a.order - b.order)
    .map(({ key, label, tasks }) => ({ key, label, tasks }));
});

const groupModeOptions = computed(() => [
  { value: 'none', label: t('task.groupNone') },
  { value: 'date', label: t('task.dueDate') },
  { value: 'priority', label: t('task.priority') },
]);

const totalTaskCount = computed(() => rawTopActive.value.length + rawTopDone.value.length);

const completedPct = computed(() => {
  if (!totalTaskCount.value) {
    return 0;
  }
  return Math.round((rawTopDone.value.length / totalTaskCount.value) * 100);
});

const completedOpenByList = computed<Record<string, boolean>>(() => {
  try {
    const raw = localStorage.getItem(COMPLETED_OPEN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
});

const aiOpenByList = computed<Record<string, boolean>>(() => {
  try {
    const raw = localStorage.getItem(AI_OPEN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
});

// -------------------------------------------------- Watchers --------------------------------------------------
watch(
  sortedActive,
  (next) => {
    draggableList.value = [...next];
  },
  { immediate: true, deep: true },
);

watch(
  listId,
  (id) => {
    if (!id) {
      bCompletedOpen.value = false;
      bAiOpen.value = false;
      return;
    }
    const savedCompleted = completedOpenByList.value[id];
    bCompletedOpen.value = typeof savedCompleted === 'boolean' ? savedCompleted : false;
    const savedAi = aiOpenByList.value[id];
    bAiOpen.value = typeof savedAi === 'boolean' ? savedAi : false;
  },
  { immediate: true },
);

watch([listId, bCompletedOpen], ([id, isOpen]) => {
  if (!id) return;
  const current = { ...completedOpenByList.value };
  current[id] = isOpen;
  localStorage.setItem(COMPLETED_OPEN_STORAGE_KEY, JSON.stringify(current));
});

watch([listId, bAiOpen], ([id, isOpen]) => {
  if (!id) return;
  const current = { ...aiOpenByList.value };
  current[id] = isOpen;
  localStorage.setItem(AI_OPEN_STORAGE_KEY, JSON.stringify(current));
});

// -------------------------------------------------- Methods --------------------------------------------------
const load = async (): Promise<void> => {
  await Promise.all([tasksStore.fetchTasks({ listId: listId.value }), listsStore.fetchLists()]);
};

useRefetchWhenReachable(() => load());

const subCount = (task: Task): number => {
  return tasksStore.subTasksOf(task.id).length;
};

const onReorder = async (): Promise<void> => {
  if (groupMode.value !== 'none' || !canEditCurrentList.value) {
    return;
  }
  const items = draggableList.value.map((task, index) => ({
    id: task.id,
    sortOrder: index,
  }));
  await tasksStore.reorderTasks(items);
  await load();
};

const addTask = async (): Promise<void> => {
  if (!canEditCurrentList.value) {
    return;
  }
  const title = newTitle.value.trim();
  if (!title) {
    return;
  }
  const payload: Record<string, unknown> = { listId: listId.value, title };
  if (newPriority.value !== 'NONE') payload['priority'] = newPriority.value;
  if (newTagIds.value.length) payload['tagIds'] = newTagIds.value;
  if (newDueDate.value) {
    payload['dueDate'] = newDueDate.value.toISOString();
    payload['dueDateHasTime'] = newDueDateHasTime.value;
  }
  await tasksStore.createTask(payload);
  newTitle.value = '';
  newPriority.value = 'NONE';
  newTagIds.value = [];
  newDueDate.value = null;
  newDueDateHasTime.value = false;
  activePicker.value = null;
  await load();
};

const toggle = async (task: Task): Promise<void> => {
  if (!canEditCurrentList.value) {
    return;
  }
  await tasksStore.toggleDone(task.id);
  await load();
};

const openTask = async (task: Task): Promise<void> => {
  activeTask.value = await tasksStore.fetchTask(task.id);
  bTaskOpen.value = true;
};

const onOpenTaskFromDetail = async (task: Task): Promise<void> => {
  activeTask.value = await tasksStore.fetchTask(task.id);
};

const closeTaskModal = (): void => {
  bTaskOpen.value = false;
  activeTask.value = null;
};

const clearDone = async (): Promise<void> => {
  if (!canEditCurrentList.value) {
    return;
  }
  await tasksStore.clearCompleted(listId.value);
  bClearConfirm.value = false;
  await load();
};

const requestDeleteTask = (task: Task): void => {
  if (!canEditCurrentList.value) {
    return;
  }
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
  await load();
};

const onListMenuDocumentClick = (event: MouseEvent): void => {
  if (!bListMenuOpen.value || !listMenuRoot.value) {
    return;
  }
  if (!listMenuRoot.value.contains(event.target as Node)) {
    bListMenuOpen.value = false;
  }
};

const openListEditFromMenu = (): void => {
  if (!isListOwner.value) {
    return;
  }
  bListMenuOpen.value = false;
  bListModal.value = true;
};

const openShareFromMenu = (): void => {
  if (!isListOwner.value) {
    return;
  }
  bListMenuOpen.value = false;
  bShareModal.value = true;
};

const openAddOverlay = (): void => {
  if (!canEditCurrentList.value) {
    return;
  }
  activeTask.value = null;
  modalInitialTitle.value = newTitle.value.trim();
  bTaskOpen.value = true;
};

const requestDeleteListFromMenu = (): void => {
  if (!isListOwner.value) {
    return;
  }
  bListMenuOpen.value = false;
  bListDeleteConfirm.value = true;
};

const addAiSuggestions = async (titles: string[]): Promise<void> => {
  if (!canEditCurrentList.value || !titles.length) return;
  for (const title of titles) {
    await tasksStore.createTask({ listId: listId.value, title });
  }
  await load();
};

const confirmDeleteList = async (): Promise<void> => {
  if (!list.value) {
    return;
  }
  await listsStore.deleteList(list.value.id);
  bListDeleteConfirm.value = false;
  void router.push({ name: 'home' });
};

const priorityLabel = (p: Priority): string => {
  const keys: Record<Priority, string> = {
    NONE: 'priority.none',
    LOW: 'priority.low',
    MEDIUM: 'priority.medium',
    HIGH: 'priority.high',
    URGENT: 'priority.urgent',
  };
  return t(keys[p]);
};

const togglePicker = (name: 'priority' | 'tags' | 'duedate'): void => {
  if (activePicker.value === name) {
    activePicker.value = null;
  } else {
    activePicker.value = name;
    if (name === 'tags') {
      void tagsStore.fetchTags();
    }
  }
};

const onComposerFocusOut = (event: FocusEvent): void => {
  const related = event.relatedTarget as Node | null;
  if (!composerRef.value || !related || !composerRef.value.contains(related)) {
    activePicker.value = null;
  }
};

const onCreateNewTag = async (name: string): Promise<void> => {
  const tag = await tagsStore.createTag({ name });
  newTagIds.value = [...newTagIds.value, tag.id];
};

watch(listId, () => {
  bListMenuOpen.value = false;
  void listsStore.fetchLists().then(() => load());
});

watch(activeTaskQuery, async (taskId) => {
  if (bSyncingTaskQuery.value) {
    return;
  }
  if (!taskId) {
    closeTaskModal();
    return;
  }
  if (activeTask.value?.id === taskId && bTaskOpen.value) {
    return;
  }
  try {
    activeTask.value = await tasksStore.fetchTask(taskId);
    bTaskOpen.value = true;
  } catch {
    const nextQuery = { ...route.query };
    delete nextQuery['task'];
    bSyncingTaskQuery.value = true;
    await router.replace({ query: nextQuery });
    bSyncingTaskQuery.value = false;
  }
}, { immediate: true });

watch([bTaskOpen, activeTask], async ([isOpen, task]) => {
  if (bSyncingTaskQuery.value) {
    return;
  }
  const currentTaskId = typeof route.query['task'] === 'string' ? route.query['task'] : null;
  const nextTaskId = isOpen ? task?.id ?? null : null;
  if (currentTaskId === nextTaskId) {
    return;
  }
  const nextQuery = { ...route.query };
  if (nextTaskId) {
    nextQuery['task'] = nextTaskId;
  } else {
    delete nextQuery['task'];
  }
  bSyncingTaskQuery.value = true;
  await router.replace({ query: nextQuery });
  bSyncingTaskQuery.value = false;
});

// -------------------------------------------------- Lifecycle --------------------------------------------------
onMounted(() => {
  document.addEventListener('click', onListMenuDocumentClick);
  void listsStore.fetchLists().then(() => load());
});

onUnmounted(() => {
  document.removeEventListener('click', onListMenuDocumentClick);
});
</script>

<template>
  <PageShell v-if="list">
    <!-- Title + Progress -->
    <div class="mb-6">
      <div class="flex flex-wrap items-start gap-4">
        <h1 class="flex-1 text-3xl font-bold text-text-primary md:text-4xl">{{ list.title }}</h1>
        <div class="flex items-center gap-3">
          <!-- Progress -->
          <div v-if="totalTaskCount" class="text-right">
            <span class="text-sm font-semibold text-primary"
              >{{ completedPct }}% {{ t('task.complete') }}</span
            >
            <div class="mt-1 h-1.5 w-36 rounded-full bg-border">
              <div
                class="h-full rounded-full bg-primary transition-all"
                :style="{ width: completedPct + '%' }"
              />
            </div>
          </div>
          <!-- List actions -->
          <div ref="listMenuRoot" class="relative">
            <button
              type="button"
              class="button is-icon is-transparent"
              @click.stop="bListMenuOpen = !bListMenuOpen"
            >
              <MoreVertical class="h-5 w-5" />
            </button>
            <div
              v-if="bListMenuOpen"
              class="absolute right-0 top-full z-20 mt-1 min-w-44 rounded-xl border border-border bg-surface py-1 shadow-lg"
              @click.stop
            >
              <button
                v-if="isListOwner"
                type="button"
                class="block w-full px-3 py-2 text-left text-sm hover:bg-fg/[0.05]"
                @click="openListEditFromMenu"
              >
                {{ t('common.edit') }}
              </button>
              <button
                v-if="isListOwner"
                type="button"
                class="block w-full px-3 py-2 text-left text-sm hover:bg-fg/[0.05]"
                @click="openShareFromMenu"
              >
                {{ t('list.share') }}
              </button>
              <button
                v-if="isListOwner"
                type="button"
                class="block w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                @click="requestDeleteListFromMenu"
              >
                {{ t('common.delete') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="pb-36 md:pb-40">
      <!-- Active Tasks section -->
      <div class="mb-3 flex items-start justify-between gap-3">
        <div class="flex min-w-0 flex-1 items-start gap-2">
          <span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
          <div>
            <h2 class="font-semibold text-text-primary">{{ t('task.activeTasks') }}</h2>
            <span class="text-xs text-text-muted">
              {{ t('task.itemsRemaining', { n: sortedActive.length }) }}
            </span>
          </div>
        </div>
        <div class="shrink-0">
          <div class="md:hidden">
            <label class="sr-only" for="group-by-mobile">{{ t('task.groupBy') }}</label>
            <select
              id="group-by-mobile"
              v-model="groupMode"
              class="!h-8 !min-h-8 !max-h-8 rounded-md border-0 !bg-transparent px-2 text-xs text-text-primary shadow-none ring-0 focus:ring-0"
            >
              <option v-for="option in groupModeOptions" :key="option.value" :value="option.value">
                {{ t('task.groupBy') }}: {{ option.label }}
              </option>
            </select>
          </div>
          <div class="hidden md:block">
            <ButtonMultiselect
              v-model="groupMode"
              :options="groupModeOptions"
              :aria-label="t('task.groupBy')"
            />
          </div>
        </div>
      </div>

      <div class="list-view mb-6">
        <draggable
          v-if="groupMode === 'none'"
          v-model="draggableList"
          item-key="id"
          handle=".drag-handle"
          class="list-view-items"
          @end="onReorder"
        >
          <template #item="{ element: task }">
            <TaskRow
              :task="task"
              :subtask-count="subCount(task)"
              :show-drag-handle="true"
              :can-edit="canEditCurrentList"
              @toggle-done="toggle"
              @open="openTask"
              @delete="requestDeleteTask"
            />
          </template>
        </draggable>
        <div v-else class="list-view-items">
          <div v-for="group in groupedActive" :key="group.key" class="mb-4 last:mb-0">
            <div
              class="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted"
            >
              {{ group.label }}
              <span class="ml-1 text-[10px] font-medium text-text-muted/80"
                >({{ group.tasks.length }})</span
              >
            </div>
            <div class="list-view-items">
              <TaskRow
                v-for="task in group.tasks"
                :key="task.id"
                :task="task"
                :subtask-count="subCount(task)"
                :show-drag-handle="false"
                :can-edit="canEditCurrentList"
                @toggle-done="toggle"
                @open="openTask"
                @delete="requestDeleteTask"
              />
            </div>
          </div>
        </div>
        <div
          v-if="!sortedActive.length"
          class="rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-6 py-10 text-center"
        >
          <div
            class="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <CheckCircle2 class="h-6 w-6" />
          </div>
          <p class="text-base font-semibold text-text-primary">{{ t('task.noTasks') }}</p>
          <button
            type="button"
            class="button is-primary mx-auto mt-4 inline-flex h-12 items-center justify-center gap-2 !rounded-xl px-6 text-base font-semibold"
            @click="openAddOverlay"
          >
            <Plus class="h-5 w-5" />
            Add Task
          </button>
        </div>
      </div>

      <!-- AI Suggest Box (collapsible, per-list state) -->
      <details
        v-if="canEditCurrentList"
        :open="bAiOpen"
        class="mb-6"
        @toggle="bAiOpen = ($event.target as HTMLDetailsElement).open"
      >
        <summary
          class="flex cursor-pointer select-none list-none items-center gap-2 rounded-xl px-1 py-2 hover:bg-fg/[0.03]"
        >
          <Sparkles class="h-4 w-4 shrink-0 text-primary" />
          <span class="text-sm font-semibold text-text-primary">{{ t('ai.title') }}</span>
          <ChevronDown
            class="ml-auto h-4 w-4 shrink-0 text-text-muted transition-transform"
            :class="bAiOpen ? '' : '-rotate-90'"
          />
        </summary>
        <div class="mt-3">
          <AiSuggestBox :list-id="listId" @add="addAiSuggestions" />
        </div>
      </details>

      <!-- Archived Tasks section -->
      <hr v-if="sortedDone.length" class="mb-4 border-border/60" />
      <details
        v-if="sortedDone.length"
        :open="bCompletedOpen"
        @toggle="bCompletedOpen = ($event.target as HTMLDetailsElement).open"
      >
        <summary
          class="flex cursor-pointer select-none list-none items-center gap-2 rounded-xl px-1 py-2 hover:bg-fg/[0.03]"
        >
          <History class="h-4 w-4 shrink-0 text-text-muted" />
          <span class="font-semibold text-sm text-text-primary">{{ t('task.archivedTasks') }}</span>
          <span
            class="rounded-full bg-border px-1.5 py-0.5 text-[10px] font-medium text-text-muted"
          >
            {{ sortedDone.length }}
          </span>
          <ChevronDown
            class="ml-auto h-4 w-4 shrink-0 text-text-muted transition-transform"
            :class="bCompletedOpen ? '' : '-rotate-90'"
          />
        </summary>
        <div class="mt-3 space-y-2">
          <TaskRow
            v-for="task in sortedDone"
            :key="task.id"
            :task="task"
            :subtask-count="subCount(task)"
            :can-edit="canEditCurrentList"
            @toggle-done="toggle"
            @open="openTask"
            @delete="requestDeleteTask"
          />
          <div class="pt-1">
            <button
              v-if="canEditCurrentList"
              type="button"
              class="button is-destructive text-sm !rounded-xl"
              @click="bClearConfirm = true"
            >
              {{ t('task.clearCompleted') }}
            </button>
          </div>
        </div>
      </details>
    </div>

    <!-- Prominent bottom add composer -->
    <Teleport v-if="canEditCurrentList" to=".app-shell">
      <div class="fixed bottom-0 left-0 right-0 z-30 px-3 pb-3 sm:px-4 sm:pb-4 lg:left-64">
        <div
          ref="composerRef"
          class="group mx-auto w-full max-w-5xl rounded-2xl border border-border/80 bg-surface shadow-xl ring-1 ring-primary/10 backdrop-blur"
          @focusout="onComposerFocusOut"
        >
          <div class="px-2 py-2 sm:px-3 sm:py-3">
            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <input
                  v-model="newTitle"
                  type="search"
                  autocomplete="off"
                  :placeholder="t('task.addTaskPlaceholder')"
                  class="h-11! max-h-11! !rounded-xl !bg-fg/[0.04] text-sm focus:!bg-fg/[0.06] sm:h-12! sm:max-h-12! appearance-none [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
                  @keydown.enter.prevent="addTask"
                />
              </div>
              <button
                type="button"
                class="button !rounded-xl !p-0 shrink-0 bg-transparent! border-0!"
                style="
                  width: 2.5rem;
                  height: 2.5rem;
                  min-width: 2.5rem;
                  min-height: 2.5rem;
                  max-width: 2.5rem;
                  max-height: 2.5rem;
                "
                :title="t('common.edit')"
                @click="openAddOverlay"
              >
                <MoreVertical class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="button is-primary !h-10 !rounded-xl shrink-0 px-4 sm:px-6"
                @click="addTask"
              >
                <Plus class="h-5 w-5" />
                <span>{{ t('task.add') }}</span>
              </button>
            </div>
          </div>
          <div
            class="grid max-h-0 grid-cols-1 overflow-hidden px-2 opacity-0 transition-all duration-200 ease-out group-focus-within:max-h-20 group-focus-within:pb-2 group-focus-within:opacity-100 sm:px-3 sm:group-focus-within:max-h-24 sm:group-focus-within:pb-3"
            :class="{ '!max-h-20 !pb-2 !opacity-100 sm:!max-h-24 sm:!pb-3': activePicker !== null }"
          >
            <div
              class="flex items-center gap-2 overflow-x-auto pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <button
                type="button"
                class="button !h-9 !min-h-9 shrink-0 !rounded-lg px-3 text-xs"
                :class="{ 'is-primary': newPriority !== 'NONE' || activePicker === 'priority' }"
                @click.stop="togglePicker('priority')"
              >
                <Flag class="h-3.5 w-3.5" />
                {{ newPriority !== 'NONE' ? priorityLabel(newPriority) : t('task.priority') }}
              </button>
              <button
                type="button"
                class="button !h-9 !min-h-9 shrink-0 !rounded-lg px-3 text-xs"
                :class="{ 'is-primary': newTagIds.length > 0 || activePicker === 'tags' }"
                @click.stop="togglePicker('tags')"
              >
                <Tags class="h-3.5 w-3.5" />
                {{ newTagIds.length > 0 ? `${t('task.tags')} (${newTagIds.length})` : t('task.tags') }}
              </button>
              <button
                type="button"
                class="button !h-9 !min-h-9 shrink-0 !rounded-lg px-3 text-xs"
                :class="{ 'is-primary': newDueDate !== null || activePicker === 'duedate' }"
                @click.stop="togglePicker('duedate')"
              >
                <CalendarClock class="h-3.5 w-3.5" />
                {{ t('task.dueDate') }} + {{ t('task.time') }}
              </button>
            </div>
          </div>
          <!-- Inline picker panels -->
          <div
            v-if="activePicker"
            class="border-t border-border/40 px-2 pb-2 pt-2 sm:px-3 sm:pb-3"
          >
            <!-- Priority picker -->
            <div v-if="activePicker === 'priority'" class="flex flex-wrap gap-1.5">
              <button
                v-for="p in PRIORITIES"
                :key="p"
                type="button"
                class="button !h-8 !min-h-8 shrink-0 !rounded-lg px-3 text-xs"
                :class="{ 'is-primary': newPriority === p }"
                @click.stop="newPriority = p"
              >
                {{ p === 'URGENT' ? '! ' : '' }}{{ priorityLabel(p) }}
              </button>
            </div>
            <!-- Tags picker -->
            <div v-else-if="activePicker === 'tags'" class="text-sm">
              <TagChipsInput
                v-model="newTagIds"
                :all-tags="tagsStore.tags"
                @create="onCreateNewTag"
              />
            </div>
            <!-- Due date + time picker -->
            <div v-else-if="activePicker === 'duedate'">
              <DateTimePicker
                v-model:date="newDueDate"
                v-model:has-time="newDueDateHasTime"
                :placeholder="t('task.dueDate')"
              />
            </div>
          </div>
        </div>
      </div>
    </Teleport>
    <ListEditModal
      :is-open="bListModal"
      :list="list"
      @close="bListModal = false"
      @saved="bListModal = false"
    />
    <ListShareModal v-if="list" :show="bShareModal" :list="list" @close="bShareModal = false" />
    <ConfirmModal
      :is-open="bListDeleteConfirm"
      :title="t('list.delete')"
      :message="t('list.confirmDelete')"
      :confirm-label="t('common.delete')"
      destructive
      @close="bListDeleteConfirm = false"
      @confirm="confirmDeleteList"
    />
    <TaskDetailModal
      :is-open="bTaskOpen"
      :task="activeTask"
      :list-id="listId"
      :can-edit="canEditCurrentList"
      :initial-title="modalInitialTitle"
      @close="closeTaskModal"
      @saved="
        if (!activeTask) {
          newTitle = '';
          modalInitialTitle = '';
        }
        closeTaskModal();
        load();
      "
      @open-task="onOpenTaskFromDetail"
    />
    <GsapModal :show="bClearConfirm">
      <div class="modal-backdrop" @click="bClearConfirm = false" />
      <div class="modal-panel max-w-sm">
        <div class="modal-body">{{ t('task.confirmClearDone') }}</div>
        <div class="modal-footer">
          <button type="button" class="button" @click="bClearConfirm = false">
            {{ t('common.cancel') }}
          </button>
          <button type="button" class="button is-destructive" @click="clearDone">
            {{ t('common.confirm') }}
          </button>
        </div>
      </div>
    </GsapModal>
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
