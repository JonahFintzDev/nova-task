<script setup lang="ts">
// node_modules
import { ChevronDown, FolderOpen, X } from 'lucide-vue-next';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

// lib
import { markdownToSafeHtml } from '@/lib/markdown';
import { browserReportsOnline } from '@/lib/pwa-offline-tasks';
import { isOverdue } from '@/lib/utils';

// classes
import { healthApi, recurrenceApi } from '@/classes/api';
import { prefersReducedMotion } from '@/lib/gsap';

// components
import GsapModal from '@/components/shared/GsapModal.vue';
import AiSuggestBox from '@/components/task/AiSuggestBox.vue';
import ButtonMultiselect from '@/components/shared/ButtonMultiselect.vue';
import DateTimePicker from '@/components/shared/DateTimePicker.vue';
import RecurrencePicker from '@/components/task/RecurrencePicker.vue';
import SubTaskList from '@/components/task/SubTaskList.vue';
import TagChipsInput from '@/components/shared/TagChipsInput.vue';
import CommentsSection from '@/components/CommentsSection.vue';
import TaskAssign from '@/components/TaskAssign.vue';

// stores
import { useListsStore } from '@/stores/lists';
import { useSettingsStore } from '@/stores/settings';
import { useTagsStore } from '@/stores/tags';
import { useTasksStore } from '@/stores/tasks';

// types
import type { Priority, RecurringRule, Task } from '@/@types/index';

// -------------------------------------------------- Props --------------------------------------------------
const props = defineProps<{
  isOpen: boolean;
  task?: Task | null;
  listId?: string;
  parentTaskId?: string | null;
  initialTitle?: string;
  canEdit?: boolean;
}>();

// -------------------------------------------------- Emits --------------------------------------------------
const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'saved', task: Task): void;
  (event: 'openTask', task: Task): void;
}>();

// -------------------------------------------------- Store --------------------------------------------------
const tasksStore = useTasksStore();
const listsStore = useListsStore();
const settingsStore = useSettingsStore();
const tagsStore = useTagsStore();
const { t } = useI18n();

// -------------------------------------------------- Data --------------------------------------------------
const title = ref('');
const description = ref('');
const dueAt = ref<Date | null>(null);
const dueDateHasTime = ref(false);
const priority = ref<Priority>('NONE');
const selectedTagIds = ref<string[]>([]);
const bSaving = ref(false);
const descriptionMode = ref<'edit' | 'preview'>('edit');
const bPriorityMenuOpen = ref(false);
const priorityMenuRoot = ref<HTMLElement | null>(null);
const bReminderMenuOpen = ref(false);
const reminderMenuRoot = ref<HTMLElement | null>(null);

// Recurrence
const currentRule = ref<RecurringRule | null>(null);
const pendingRule = ref<
  { frequency: RecurringRule['frequency']; interval: number } | null | undefined
>(undefined);

// Reminder
const reminderOffset = ref<number | null>(null);
const commentsEnabled = ref(true);

const REMINDER_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'task.reminderNone', value: null },
  { label: 'task.reminder15m', value: 15 },
  { label: 'task.reminder30m', value: 30 },
  { label: 'task.reminder1h', value: 60 },
  { label: 'task.reminder3h', value: 180 },
  { label: 'task.reminder1d', value: 1440 },
  { label: 'task.reminder2d', value: 2880 },
  { label: 'task.reminder1w', value: 10080 },
];

const PRIORITIES: readonly Priority[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const normalizeListId = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'value' in value) {
    const nested = (value as { value?: unknown }).value;
    if (typeof nested === 'string') {
      return nested;
    }
  }
  return '';
};

interface FormSnapshot {
  title: string;
  description: string;
  dueAtIso: string | null;
  priority: Priority;
  tagIds: string[];
}

const snapshot = ref<FormSnapshot | null>(null);
const titleInputRef = ref<HTMLInputElement | null>(null);

// -------------------------------------------------- Computed --------------------------------------------------
const effectiveListId = computed(() => {
  const fromTask = props.task?.listId;
  if (fromTask) {
    return fromTask;
  }
  const fromProps = normalizeListId(props.listId);
  if (fromProps) {
    return fromProps;
  }
  return listsStore.lists[0]?.id ?? '';
});

const currentList = computed(() => listsStore.listById(effectiveListId.value));
const canEditTask = computed(() => props.canEdit !== false);
const commentsAvailableForList = computed(() => currentList.value?.commentsEnabled !== false);

const breadcrumbParts = computed(() => {
  const list = currentList.value;
  if (!list) {
    return [];
  }
  const cat = list.category?.trim();
  return cat ? [cat, list.title] : [list.title];
});

const renderedDescriptionHtml = computed(() => markdownToSafeHtml(description.value));

const isListShared = computed(() => currentList.value?.isShared === true);

const reminderLabel = computed(() => {
  const opt = REMINDER_OPTIONS.find((o) => o.value === reminderOffset.value);
  return opt ? t(opt.label) : t('task.reminderNone');
});

const isTaskOverdue = computed(() => {
  if (!dueAt.value) {
    return false;
  }
  return isOverdue(dueAt.value.toISOString(), false, dueDateHasTime.value);
});

const priorityCardClass = computed(() => {
  if (priority.value === 'NONE') {
    return 'bg-border/40 text-text-muted';
  }
  if (priority.value === 'LOW') {
    return 'bg-fg/5 text-text-muted';
  }
  if (priority.value === 'MEDIUM') {
    return 'bg-warning/10 text-warning';
  }
  if (priority.value === 'HIGH') {
    return 'bg-primary/10 text-primary';
  }
  return 'bg-destructive/10 text-destructive';
});

const subtaskProgress = computed(() => {
  if (!props.task) {
    return null;
  }
  const subs = tasksStore.subTasksOf(props.task.id);
  const total = subs.length;
  const done = subs.filter((s) => s.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
});

const descriptionModeOptions = computed(() => [
  { value: 'edit', label: t('task.descriptionEdit') },
  { value: 'preview', label: t('task.descriptionPreview') },
]);

// -------------------------------------------------- Watchers --------------------------------------------------
watch(
  () =>
    [
      props.isOpen,
      props.task?.id ?? '',
      props.listId ?? '',
      props.parentTaskId ?? '',
      props.initialTitle ?? '',
    ] as const,
  async () => {
    if (!props.isOpen) {
      return;
    }
    try {
      const health = await healthApi.check();
      commentsEnabled.value = health.commentsEnabled;
    } catch {
      commentsEnabled.value = true;
    }
    try {
      await tagsStore.fetchTags();
    } catch {
      /* offline: keep existing tag list */
    }
    try {
      await listsStore.fetchLists();
    } catch {
      /* offline: keep cached lists */
    }
    if (props.task) {
      title.value = props.task.title;
      description.value = props.task.description ?? '';
      if (props.task.dueDate) {
        const d = new Date(props.task.dueDate);
        if (Number.isNaN(d.getTime())) {
          dueAt.value = null;
          dueDateHasTime.value = false;
        } else {
          dueAt.value = d;
          dueDateHasTime.value = props.task.dueDateHasTime;
        }
      } else {
        dueAt.value = null;
        dueDateHasTime.value = false;
      }

      priority.value = props.task.priority;
      selectedTagIds.value = props.task.tags.map((tag) => tag.id);
      // Load recurrence rule
      currentRule.value = props.task.recurringRule ?? null;
      pendingRule.value = undefined;
      reminderOffset.value = props.task.reminderOffset ?? null;
    } else {
      title.value = props.initialTitle ?? '';
      description.value = '';
      dueAt.value = null;
      dueDateHasTime.value = false;
      priority.value = 'NONE';
      selectedTagIds.value = [];
      currentRule.value = null;
      pendingRule.value = undefined;
      reminderOffset.value = null;
    }
    descriptionMode.value = description.value.trim() ? 'preview' : 'edit';
    captureSnapshot();
    if (!props.task && canEditTask.value) {
      void focusTitleForNewTask();
    }
  },
);

async function focusTitleForNewTask(): Promise<void> {
  await nextTick();
  const apply = (): void => {
    const el = titleInputRef.value;
    if (!el || props.task || !props.isOpen || !canEditTask.value) {
      return;
    }
    el.focus({ preventScroll: true });
    if (el.value.length > 0) {
      el.select();
    }
  };
  if (prefersReducedMotion()) {
    requestAnimationFrame(apply);
    return;
  }
  window.setTimeout(apply, 320);
}

watch(dueAt, (value) => {
  if (value === null) dueDateHasTime.value = false;
});

// -------------------------------------------------- Methods --------------------------------------------------
const captureSnapshot = (): void => {
  snapshot.value = {
    title: title.value,
    description: description.value,
    dueAtIso: dueAt.value ? dueAt.value.toISOString() : null,
    priority: priority.value,
    tagIds: [...selectedTagIds.value],
  };
};

const discardChanges = (): void => {
  const s = snapshot.value;
  if (!s) {
    return;
  }
  title.value = s.title;
  description.value = s.description;
  dueAt.value = s.dueAtIso ? new Date(s.dueAtIso) : null;
  priority.value = s.priority;
  selectedTagIds.value = [...s.tagIds];
  descriptionMode.value = description.value.trim() ? 'preview' : 'edit';
};

const close = (): void => {
  emit('close');
};

const duePayload = (): string | null => {
  if (!dueAt.value) {
    return null;
  }
  return dueAt.value.toISOString();
};

const save = async (): Promise<void> => {
  if (!canEditTask.value) {
    return;
  }
  if (!title.value.trim() || !effectiveListId.value) {
    return;
  }
  bSaving.value = true;
  try {
    let savedTask: Task;
    if (props.task) {
      savedTask = await tasksStore.updateTask(props.task.id, {
        title: title.value.trim(),
        description: description.value || null,
        dueDate: duePayload(),
        dueDateHasTime: dueDateHasTime.value,
        priority: priority.value,
        tagIds: selectedTagIds.value,
        reminderOffset: dueAt.value ? reminderOffset.value : null,
      });
    } else {
      savedTask = await tasksStore.createTask({
        listId: effectiveListId.value,
        title: title.value.trim(),
        description: description.value || null,
        dueDate: duePayload(),
        dueDateHasTime: dueDateHasTime.value,
        priority: priority.value,
        parentTaskId: props.parentTaskId ?? null,
        tagIds: selectedTagIds.value,
        reminderOffset: dueAt.value ? reminderOffset.value : null,
      });
    }
    // Persist recurrence rule if changed (requires network)
    if (pendingRule.value !== undefined && browserReportsOnline()) {
      if (pendingRule.value === null) {
        if (currentRule.value) {
          await recurrenceApi.remove(savedTask.id);
        }
      } else {
        await recurrenceApi.set(savedTask.id, pendingRule.value);
      }
    }
    emit('saved', savedTask);
    close();
  } finally {
    bSaving.value = false;
  }
};

const onRecurrenceUpdate = (
  rule: { frequency: RecurringRule['frequency']; interval: number } | null,
): void => {
  if (!canEditTask.value) {
    return;
  }
  pendingRule.value = rule;
};

const addAiSubtasks = async (titles: string[]): Promise<void> => {
  if (!props.task || !canEditTask.value) return;
  for (const t of titles) {
    await tasksStore.createTask({
      listId: props.task.listId,
      title: t,
      parentTaskId: props.task.id,
    });
  }
};

const onCreateTag = async (name: string): Promise<void> => {
  if (!canEditTask.value) {
    return;
  }
  const tag = await tagsStore.createTag({ name });
  selectedTagIds.value = [...selectedTagIds.value, tag.id];
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

const selectPriority = (p: Priority): void => {
  priority.value = p;
  bPriorityMenuOpen.value = false;
};

const onPriorityMenuDocumentClick = (event: MouseEvent): void => {
  if (bPriorityMenuOpen.value && priorityMenuRoot.value) {
    if (!priorityMenuRoot.value.contains(event.target as Node)) {
      bPriorityMenuOpen.value = false;
    }
  }
  if (bReminderMenuOpen.value && reminderMenuRoot.value) {
    if (!reminderMenuRoot.value.contains(event.target as Node)) {
      bReminderMenuOpen.value = false;
    }
  }
};

// -------------------------------------------------- Lifecycle --------------------------------------------------
onMounted(() => {
  document.addEventListener('click', onPriorityMenuDocumentClick);
  void settingsStore.load();
});

onUnmounted(() => {
  document.removeEventListener('click', onPriorityMenuDocumentClick);
});
</script>

<template>
  <GsapModal :show="props.isOpen">
    <div class="modal-backdrop" @click="close" />
    <div class="modal-panel max-w-5xl">
      <div class="modal-header flex-wrap gap-3 border-b border-border">
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div
            v-if="breadcrumbParts.length"
            class="flex min-w-0 items-center gap-1.5 text-xs text-text-muted"
          >
            <FolderOpen class="h-3.5 w-3.5 shrink-0 text-primary/80" />
            <span class="min-w-0 truncate">
              {{ breadcrumbParts.join(' / ') }}
            </span>
          </div>
          <span v-else class="text-xs text-text-muted">{{ t('task.new') }}</span>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <button type="button" class="close-button" @click="close">
            <X class="h-5 w-5" />
          </button>
        </div>
      </div>
      <div
        class="modal-body !space-y-0 !px-0 !py-0 grid max-h-[min(70vh,720px)] grid-cols-1 overflow-y-auto lg:max-h-[min(78vh,820px)] lg:grid-cols-[minmax(0,1fr)_280px]"
      >
        <div class="min-w-0 space-y-6 border-border px-6 py-5 lg:border-e">
          <div class="field !mb-0">
            <label class="sr-only">{{ t('task.title') }}</label>
            <input
              ref="titleInputRef"
              v-model="title"
              type="text"
              :readonly="!canEditTask"
              class="!h-10 !max-h-10 !min-h-[40px] !border-0 !bg-transparent !px-0 !py-0 !text-xl !font-bold !leading-none !text-text-primary !ring-0 !outline-none focus:!ring-0"
              :placeholder="t('task.title')"
            />
          </div>

          <div>
            <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span class="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                {{ t('task.description') }}
              </span>
              <ButtonMultiselect
                v-if="canEditTask"
                v-model="descriptionMode"
                :options="descriptionModeOptions"
                :aria-label="t('task.description')"
              />
            </div>
            <textarea
              v-if="descriptionMode === 'edit'"
              v-model="description"
              :readonly="!canEditTask"
              class="min-h-[200px] w-full resize-none font-mono text-sm leading-relaxed"
              :placeholder="t('task.descriptionPlaceholder')"
            />
            <div
              v-else
              class="task-md-preview min-h-[200px] rounded-lg border border-border bg-bg/50 px-3 py-2 text-sm leading-relaxed"
            >
              <div
                v-if="renderedDescriptionHtml"
                class="task-md-content"
                v-html="renderedDescriptionHtml"
              />
              <p v-else class="text-text-muted italic">{{ t('task.previewEmpty') }}</p>
            </div>
            <p class="mt-2 text-xs italic text-text-muted">{{ t('task.markdownSupported') }}</p>
          </div>
          <div v-if="props.task">
            <div class="mb-3 space-y-1.5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  {{ t('task.subtasks') }}
                  <template v-if="subtaskProgress">
                    — {{ subtaskProgress.done }} {{ t('task.of') }} {{ subtaskProgress.total }}
                    {{ t('task.tasksCompleted') }}
                  </template>
                </span>
                <span
                  v-if="subtaskProgress && subtaskProgress.total > 0"
                  class="text-xs font-semibold text-primary"
                >
                  {{ subtaskProgress.pct }}%
                </span>
              </div>
              <!-- Subtask progress bar -->
              <div
                v-if="subtaskProgress && subtaskProgress.total > 0"
                class="h-1.5 w-full rounded-full bg-border"
              >
                <div
                  class="h-full rounded-full bg-primary transition-all"
                  :style="{ width: subtaskProgress.pct + '%' }"
                />
              </div>
            </div>
            <SubTaskList
              :parent-task="props.task"
              :list-id="props.task.listId"
              :depth="0"
              embedded
            />
            <div v-if="canEditTask && !settingsStore.aiFeaturesDisabled" class="mt-3">
              <AiSuggestBox
                :list-id="props.task.listId"
                :task-id="props.task.id"
                :task-title="title"
                @add="addAiSubtasks"
              />
            </div>
          </div>

          <!-- Comments -->
          <div
            v-if="props.task && commentsEnabled && commentsAvailableForList"
            class="border-t border-border pt-6"
          >
            <CommentsSection :task="props.task" :can-edit="canEditTask" />
          </div>
        </div>
        <aside class="min-w-0 space-y-5 rounded-br-xl bg-bg/20 px-6 py-5">
          <!-- Assignment (shared lists only) -->
          <div v-if="props.task && isListShared" class="field">
            <label
              class="label !mb-2 !text-[10px] !font-semibold !uppercase !tracking-wide !text-text-muted"
            >
              {{ t('task.assignedTo') }}
            </label>
            <TaskAssign
              :task="props.task"
              :can-assign="canEditTask"
              @assigned="async () => await tasksStore.fetchTasks()"
              @unassigned="async () => await tasksStore.fetchTasks()"
            />
          </div>

          <!-- Priority -->
          <div class="field">
            <label
              class="label !mb-2 !text-[10px] !font-semibold !uppercase !tracking-wide !text-text-muted"
            >
              {{ t('task.priority') }}
            </label>
            <div ref="priorityMenuRoot" class="relative hidden md:block">
              <button
                v-if="canEditTask"
                type="button"
                class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-normal bg-bg!"
                :class="priorityCardClass"
                @click.stop="bPriorityMenuOpen = !bPriorityMenuOpen"
              >
                <span v-if="priority === 'URGENT'" class="shrink-0">!</span>
                <span
                  v-else-if="priority !== 'NONE'"
                  class="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
                />
                <span>{{ priorityLabel(priority) }}</span>
                <ChevronDown class="ms-auto h-4 w-4 shrink-0 opacity-70" />
              </button>
              <div
                v-if="bPriorityMenuOpen"
                class="absolute left-0 top-full z-20 mt-1 w-full min-w-44 rounded-xl border border-border bg-surface py-1 shadow-lg"
                @click.stop
              >
                <button
                  v-for="p in PRIORITIES"
                  :key="p"
                  type="button"
                  class="block w-full px-3 py-2 text-left text-sm hover:bg-fg/[0.05]"
                  :class="
                    p === priority ? 'font-normal text-primary' : 'font-normal text-text-primary'
                  "
                  @click="selectPriority(p)"
                >
                  {{ p === 'URGENT' ? '! ' : '' }}{{ priorityLabel(p) }}
                </button>
              </div>
            </div>
            <select
              v-model="priority"
              :disabled="!canEditTask"
              class="w-full !rounded-lg md:hidden"
            >
              <option v-for="p in PRIORITIES" :key="p" :value="p">
                {{ p === 'URGENT' ? '! ' : '' }}{{ priorityLabel(p) }}
              </option>
            </select>
          </div>

          <!-- Due Date -->
          <div class="field">
            <label
              class="label !mb-2 !text-[10px] !font-semibold !uppercase !tracking-wide !text-text-muted"
            >
              {{ t('task.dueDate') }}
            </label>
            <div class="mb-2">
              <DateTimePicker
                v-model:date="dueAt"
                v-model:has-time="dueDateHasTime"
                :disabled="!canEditTask"
                :placeholder="t('task.dueDate')"
              />
            </div>

            <span
              v-if="isTaskOverdue"
              class="w-fit rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive"
            >
              {{ t('task.overdue') }}
            </span>
            <!-- Reminder -->
            <div v-if="dueAt" class="mt-3">
              <label
                class="label !mb-1.5 !text-[10px] !font-semibold !uppercase !tracking-wide !text-text-muted"
              >
                {{ t('task.reminder') }}
              </label>
              <!-- Desktop custom dropdown -->
              <div ref="reminderMenuRoot" class="relative hidden md:block">
                <button
                  v-if="canEditTask"
                  type="button"
                  class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-normal bg-bg! bg-border/40 text-text-muted"
                  @click.stop="bReminderMenuOpen = !bReminderMenuOpen"
                >
                  <span>{{ reminderLabel }}</span>
                  <ChevronDown class="ms-auto h-4 w-4 shrink-0 opacity-70" />
                </button>
                <span v-else class="text-sm text-text-muted">{{ reminderLabel }}</span>
                <div
                  v-if="bReminderMenuOpen"
                  class="absolute left-0 top-full z-20 mt-1 w-full min-w-44 rounded-xl border border-border bg-surface py-1 shadow-lg"
                  @click.stop
                >
                  <button
                    v-for="opt in REMINDER_OPTIONS"
                    :key="String(opt.value)"
                    type="button"
                    class="block w-full px-3 py-2 text-left text-sm hover:bg-fg/[0.05]"
                    :class="
                      opt.value === reminderOffset
                        ? 'font-normal text-primary'
                        : 'font-normal text-text-primary'
                    "
                    @click="
                      reminderOffset = opt.value;
                      bReminderMenuOpen = false;
                    "
                  >
                    {{ t(opt.label) }}
                  </button>
                </div>
              </div>
              <!-- Mobile select -->
              <select
                v-model="reminderOffset"
                :disabled="!canEditTask"
                class="w-full !rounded-lg md:hidden"
              >
                <option v-for="opt in REMINDER_OPTIONS" :key="String(opt.value)" :value="opt.value">
                  {{ t(opt.label) }}
                </option>
              </select>
            </div>
          </div>

          <!-- Tags -->
          <div class="field">
            <label
              class="label !mb-2 !text-[10px] !font-semibold !uppercase !tracking-wide !text-text-muted"
            >
              {{ t('task.tags') }}
            </label>
            <TagChipsInput
              v-model="selectedTagIds"
              :all-tags="tagsStore.tags"
              :disabled="!canEditTask"
              @create="onCreateTag"
            />
          </div>

          <!-- Recurrence -->
          <div v-if="props.task && !props.task.parentTaskId" class="field">
            <label
              class="label !mb-2 !text-[10px] !font-semibold !uppercase !tracking-wide !text-text-muted"
            >
              {{ t('recurrence.label') }}
            </label>
            <RecurrencePicker
              :rule="
                pendingRule !== undefined
                  ? pendingRule
                    ? {
                        ...pendingRule,
                        id: '',
                        taskId: props.task.id,
                        streak: currentRule?.streak ?? 0,
                        createdAt: '',
                      }
                    : null
                  : currentRule
              "
              :task-id="props.task.id"
              @update="onRecurrenceUpdate"
            />
          </div>

          <!-- Timestamps -->
          <div
            v-if="props.task"
            class="space-y-1 border-t border-border/50 pt-4 text-[11px] text-text-muted"
          >
            <div v-if="props.task.createdAt" class="flex justify-between gap-2">
              <span>{{ t('task.created') }}</span>
              <span class="font-medium text-text-primary">
                {{
                  new Date(props.task.createdAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                }}
              </span>
            </div>
            <div v-if="props.task.updatedAt" class="flex justify-between gap-2">
              <span>{{ t('task.lastUpdated') }}</span>
              <span class="font-medium text-text-primary">
                {{
                  new Date(props.task.updatedAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                }}
              </span>
            </div>
          </div>
        </aside>
      </div>
      <div class="modal-footer justify-between gap-3">
        <button
          v-if="canEditTask"
          type="button"
          class="button is-transparent text-sm text-text-muted hover:text-text-primary"
          @click="discardChanges"
        >
          {{ t('task.discardChanges') }}
        </button>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <button type="button" class="button !rounded-xl" @click="close">
            {{ t('common.cancel') }}
          </button>
          <button
            v-if="canEditTask"
            type="button"
            class="button is-primary !rounded-xl"
            :disabled="bSaving"
            @click="save"
          >
            <span v-if="bSaving" class="loading-spinner" />
            {{ t('task.saveTask') }}
          </button>
        </div>
      </div>
    </div>
  </GsapModal>
</template>

<style scoped>
.task-md-preview :deep(.task-md-content) {
  word-break: break-word;
}

.task-md-preview :deep(.task-md-content > :first-child) {
  margin-top: 0;
}

.task-md-preview :deep(.task-md-content > :last-child) {
  margin-bottom: 0;
}

.task-md-preview :deep(.task-md-content p) {
  margin: 0 0 0.65em;
}

.task-md-preview :deep(.task-md-content ul),
.task-md-preview :deep(.task-md-content ol) {
  margin: 0 0 0.65em;
  padding-left: 1.35em;
}

.task-md-preview :deep(.task-md-content ul) {
  list-style: disc;
}

.task-md-preview :deep(.task-md-content ol) {
  list-style: decimal;
}

.task-md-preview :deep(.task-md-content li) {
  margin-bottom: 0.25em;
}

.task-md-preview :deep(.task-md-content h1),
.task-md-preview :deep(.task-md-content h2),
.task-md-preview :deep(.task-md-content h3) {
  margin: 0.65em 0 0.4em;
  font-weight: 600;
  line-height: 1.25;
}

.task-md-preview :deep(.task-md-content h1) {
  font-size: 1.25rem;
}

.task-md-preview :deep(.task-md-content h2) {
  font-size: 1.1rem;
}

.task-md-preview :deep(.task-md-content h3) {
  font-size: 1rem;
}

.task-md-preview :deep(.task-md-content a) {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.task-md-preview :deep(.task-md-content code) {
  font-family: var(--font-family-mono);
  font-size: 0.85em;
  padding: 0.1em 0.35em;
  border-radius: 0.25rem;
  background: color-mix(in srgb, var(--color-card) 80%, transparent);
  border: 1px solid var(--color-border);
}

.task-md-preview :deep(.task-md-content pre) {
  margin: 0.65em 0;
  padding: 0.75em 1em;
  overflow: auto;
  border-radius: 0.375rem;
  background: color-mix(in srgb, var(--color-bg) 90%, transparent);
  border: 1px solid var(--color-border);
}

.task-md-preview :deep(.task-md-content pre code) {
  padding: 0;
  border: none;
  background: transparent;
}

.task-md-preview :deep(.task-md-content blockquote) {
  margin: 0.65em 0;
  padding-left: 0.85em;
  border-left: 3px solid var(--color-primary);
  color: var(--color-text-muted);
}
</style>
