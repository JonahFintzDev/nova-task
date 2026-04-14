<script setup lang="ts">
// node_modules
import draggable from 'vuedraggable';
import { CheckCircle2, ChevronDown, History, MoreVertical, Plus } from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

// components
import ListEditModal from '@/components/list/ListEditModal.vue';
import ConfirmModal from '@/components/shared/ConfirmModal.vue';
import GsapModal from '@/components/shared/GsapModal.vue';
import PageShell from '@/components/layout/PageShell.vue';
import TaskDetailModal from '@/components/task/TaskDetailModal.vue';
import TaskRow from '@/components/task/TaskRow.vue';

// stores
import { useListsStore } from '@/stores/lists';
import { useTasksStore } from '@/stores/tasks';

// types
import type { Task } from '@/@types/index';

// -------------------------------------------------- Store --------------------------------------------------

const route = useRoute();
const router = useRouter();
const listsStore = useListsStore();
const tasksStore = useTasksStore();
const { t } = useI18n();

// -------------------------------------------------- Data --------------------------------------------------

const newTitle = ref('');
const sortMode = ref<'manual' | 'due' | 'priority'>('manual');
const bListModal = ref(false);
const bListMenuOpen = ref(false);
const listMenuRoot = ref<HTMLElement | null>(null);
const bListDeleteConfirm = ref(false);
const bTaskOpen = ref(false);
const activeTask = ref<Task | null>(null);
const bCompletedOpen = ref(true);
const bClearConfirm = ref(false);
const bDeleteConfirm = ref(false);
const taskPendingDelete = ref<Task | null>(null);
const draggableList = ref<Task[]>([]);
const COMPLETED_OPEN_STORAGE_KEY = 'nova-task:completed-open-by-list';

// -------------------------------------------------- Computed --------------------------------------------------

const listId = computed(() => route.params['id'] as string);
const currentListId = computed(() => String(route.params['id'] ?? ''));

const list = computed(() => listsStore.listById(listId.value));

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
  if (sortMode.value === 'due') {
    tasks.sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return da - db;
    });
  } else if (sortMode.value === 'priority') {
    const order = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] as const;
    tasks.sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority));
  } else {
    tasks.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return tasks;
});

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
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
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
      bCompletedOpen.value = true;
      return;
    }
    const saved = completedOpenByList.value[id];
    bCompletedOpen.value = typeof saved === 'boolean' ? saved : true;
  },
  { immediate: true },
);

watch([listId, bCompletedOpen], ([id, isOpen]) => {
  if (!id) {
    return;
  }
  const current = { ...completedOpenByList.value };
  current[id] = isOpen;
  localStorage.setItem(COMPLETED_OPEN_STORAGE_KEY, JSON.stringify(current));
});

// -------------------------------------------------- Methods --------------------------------------------------

async function load(): Promise<void> {
  await Promise.all([
    tasksStore.fetchTasks({ listId: listId.value }),
    listsStore.fetchLists(),
  ]);
}

function subCount(task: Task): number {
  return tasksStore.subTasksOf(task.id).length;
}

async function onReorder(): Promise<void> {
  if (sortMode.value !== 'manual') {
    return;
  }
  const items = draggableList.value.map((task, index) => ({
    id: task.id,
    sortOrder: index,
  }));
  await tasksStore.reorderTasks(items);
  await load();
}

async function addTask(): Promise<void> {
  const title = newTitle.value.trim();
  if (!title) {
    return;
  }
  await tasksStore.createTask({
    listId: listId.value,
    title,
  });
  newTitle.value = '';
  await load();
}

async function toggle(task: Task): Promise<void> {
  await tasksStore.toggleDone(task.id);
  await load();
}

async function openTask(task: Task): Promise<void> {
  activeTask.value = await tasksStore.fetchTask(task.id);
  bTaskOpen.value = true;
}

async function onOpenTaskFromDetail(task: Task): Promise<void> {
  activeTask.value = await tasksStore.fetchTask(task.id);
}

async function clearDone(): Promise<void> {
  await tasksStore.clearCompleted(listId.value);
  bClearConfirm.value = false;
  await load();
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
  await load();
}

function onListMenuDocumentClick(event: MouseEvent): void {
  if (!bListMenuOpen.value || !listMenuRoot.value) {
    return;
  }
  if (!listMenuRoot.value.contains(event.target as Node)) {
    bListMenuOpen.value = false;
  }
}

function openListEditFromMenu(): void {
  bListMenuOpen.value = false;
  bListModal.value = true;
}

function openAddOverlay(): void {
  activeTask.value = null;
  bTaskOpen.value = true;
}

function requestDeleteListFromMenu(): void {
  bListMenuOpen.value = false;
  bListDeleteConfirm.value = true;
}

async function confirmDeleteList(): Promise<void> {
  if (!list.value) {
    return;
  }
  await listsStore.deleteList(list.value.id);
  bListDeleteConfirm.value = false;
  void router.push({ name: 'home' });
}

watch(listId, () => {
  bListMenuOpen.value = false;
  void listsStore.fetchLists().then(() => load());
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
            <span class="text-sm font-semibold text-primary">{{ completedPct }}% {{ t('task.complete') }}</span>
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
                type="button"
                class="block w-full px-3 py-2 text-left text-sm hover:bg-fg/[0.05]"
                @click="openListEditFromMenu"
              >
                {{ t('common.edit') }}
              </button>
              <button
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

    <div class="pb-24 md:pb-0">
      <!-- Add task input with button -->
      <div class="mb-5 hidden items-center gap-2 md:flex">
        <input
          v-model="newTitle"
          type="text"
          :placeholder="t('task.addTaskPlaceholder')"
          class="flex-1 !rounded-xl !h-11 !bg-fg/[0.04] focus:!bg-fg/[0.06]"
          @keydown.enter.prevent="addTask"
        />
        <button type="button" class="button is-primary !rounded-xl !h-11 px-5 shrink-0" @click="addTask">
          {{ t('task.add') }}
        </button>
      </div>

      <!-- Sort controls -->
      <div class="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span class="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          {{ t('task.sort') }}
        </span>
        <div class="inline-flex flex-wrap items-center gap-x-0.5 gap-y-0.5">
          <button
            type="button"
            class="rounded px-1.5 py-0.5 text-[11px] leading-tight text-text-muted hover:text-text-primary"
            :class="sortMode === 'manual' ? 'font-medium text-primary' : ''"
            @click="sortMode = 'manual'"
          >
            {{ t('task.sortManual') }}
          </button>
          <span class="text-[10px] text-text-muted/50" aria-hidden="true">·</span>
          <button
            type="button"
            class="rounded px-1.5 py-0.5 text-[11px] leading-tight text-text-muted hover:text-text-primary"
            :class="sortMode === 'due' ? 'font-medium text-primary' : ''"
            @click="sortMode = 'due'"
          >
            {{ t('task.sortDue') }}
          </button>
          <span class="text-[10px] text-text-muted/50" aria-hidden="true">·</span>
          <button
            type="button"
            class="rounded px-1.5 py-0.5 text-[11px] leading-tight text-text-muted hover:text-text-primary"
            :class="sortMode === 'priority' ? 'font-medium text-primary' : ''"
            @click="sortMode = 'priority'"
          >
            {{ t('task.sortPriority') }}
          </button>
        </div>
      </div>

      <!-- Active Tasks section -->
      <div class="mb-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
          <h2 class="font-semibold text-text-primary">{{ t('task.activeTasks') }}</h2>
        </div>
        <span class="text-sm text-text-muted">
          {{ t('task.itemsRemaining', { n: sortedActive.length }) }}
        </span>
      </div>

      <div class="list-view mb-6">
        <draggable
          v-if="sortMode === 'manual'"
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
              @toggle-done="toggle"
              @open="openTask"
              @delete="requestDeleteTask"
            />
          </template>
        </draggable>
        <div v-else class="list-view-items">
          <TaskRow
            v-for="task in sortedActive"
            :key="task.id"
            :task="task"
            :subtask-count="subCount(task)"
            @toggle-done="toggle"
            @open="openTask"
            @delete="requestDeleteTask"
          />
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

      <!-- Archived Tasks section -->
      <hr class="mb-4 border-border/60" />
      <details
        v-if="sortedDone.length"
        :open="bCompletedOpen"
        @toggle="bCompletedOpen = ($event.target as HTMLDetailsElement).open"
      >
        <summary class="flex cursor-pointer select-none list-none items-center gap-2 rounded-xl px-1 py-2 hover:bg-fg/[0.03]">
          <History class="h-4 w-4 shrink-0 text-text-muted" />
          <span class="font-semibold text-sm text-text-primary">{{ t('task.archivedTasks') }}</span>
          <span class="rounded-full bg-border px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
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
            @toggle-done="toggle"
            @open="openTask"
            @delete="requestDeleteTask"
          />
          <div class="pt-1">
            <button type="button" class="button is-destructive text-sm !rounded-xl" @click="bClearConfirm = true">
              {{ t('task.clearCompleted') }}
            </button>
          </div>
        </div>
      </details>
    </div>

    <!-- Mobile: bottom add bar -->
    <Teleport to=".app-shell">
      <div
        class="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 p-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] backdrop-blur md:hidden"
      >
        <div class="mx-auto flex w-full max-w-3xl items-center gap-2">
          <input
            v-model="newTitle"
            type="text"
            :placeholder="t('task.addTaskPlaceholder')"
            class="flex-1 !rounded-xl !bg-fg/[0.04] focus:!bg-fg/[0.06]"
            @keydown.enter.prevent="addTask"
          />
          <button type="button" class="button is-primary !rounded-xl shrink-0 px-4" @click="addTask">
            {{ t('task.add') }}
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Mobile FAB -->
    <Teleport to=".app-shell">
      <button
        type="button"
        class="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary-hover transition-colors md:hidden"
        @click="newTitle = ''"
      >
        <Plus class="h-7 w-7" />
      </button>
    </Teleport>
    <ListEditModal :is-open="bListModal" :list="list" @close="bListModal = false" @saved="bListModal = false" />
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
      :list-id="currentListId"
      @close="bTaskOpen = false"
      @saved="
        bTaskOpen = false;
        load();
      "
      @open-task="onOpenTaskFromDetail"
    />
    <GsapModal :show="bClearConfirm">
      <div class="modal-backdrop" @click="bClearConfirm = false" />
      <div class="modal-panel max-w-sm">
        <div class="modal-body">{{ t('task.confirmClearDone') }}</div>
        <div class="modal-footer">
          <button type="button" class="button" @click="bClearConfirm = false">{{ t('common.cancel') }}</button>
          <button type="button" class="button is-destructive" @click="clearDone">{{ t('common.confirm') }}</button>
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
