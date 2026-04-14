<script setup lang="ts">
// node_modules
import { ChevronDown, FolderOpen, X } from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

// lib
import { markdownToSafeHtml } from '@/lib/markdown';
import { isOverdue } from '@/lib/utils';

// components
import GsapModal from '@/components/shared/GsapModal.vue';
import ButtonMultiselect from '@/components/shared/ButtonMultiselect.vue';
import DateTimePicker from '@/components/shared/DateTimePicker.vue';
import SubTaskList from '@/components/task/SubTaskList.vue';
import TagChipsInput from '@/components/shared/TagChipsInput.vue';

// stores
import { useListsStore } from '@/stores/lists';
import { useTagsStore } from '@/stores/tags';
import { useTasksStore } from '@/stores/tasks';

// types
import type { Priority, Task } from '@/@types/index';

// -------------------------------------------------- Props --------------------------------------------------

const props = defineProps<{
  isOpen: boolean;
  task?: Task | null;
  listId?: string;
  parentTaskId?: string | null;
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
const tagsStore = useTagsStore();
const { t } = useI18n();

// -------------------------------------------------- Data --------------------------------------------------

const title = ref('');
const description = ref('');
const dueAt = ref<Date | null>(null);
const priority = ref<Priority>('NONE');
const selectedTagIds = ref<string[]>([]);
const bSaving = ref(false);
const descriptionMode = ref<'edit' | 'preview'>('edit');
const bPriorityMenuOpen = ref(false);
const priorityMenuRoot = ref<HTMLElement | null>(null);

const PRIORITIES: readonly Priority[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'];

function normalizeListId(value: unknown): string {
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
}

interface FormSnapshot {
  title: string;
  description: string;
  dueAtIso: string | null;
  priority: Priority;
  tagIds: string[];
}

const snapshot = ref<FormSnapshot | null>(null);

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

const breadcrumbParts = computed(() => {
  const list = currentList.value;
  if (!list) {
    return [];
  }
  const cat = list.category?.trim();
  return cat ? [cat, list.title] : [list.title];
});

const renderedDescriptionHtml = computed(() => markdownToSafeHtml(description.value));

const isTaskOverdue = computed(() => {
  if (!dueAt.value) {
    return false;
  }
  return isOverdue(dueAt.value.toISOString(), false);
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
  () => [props.isOpen, props.task?.id ?? '', props.listId ?? '', props.parentTaskId ?? ''] as const,
  async () => {
    if (!props.isOpen) {
      return;
    }
    await tagsStore.fetchTags();
    await listsStore.fetchLists();
    if (props.task) {
      title.value = props.task.title;
      description.value = props.task.description ?? '';
      if (props.task.dueDate) {
        const d = new Date(props.task.dueDate);
        if (Number.isNaN(d.getTime())) {
          dueAt.value = null;
        } else {
          dueAt.value = d;
        }
      } else {
        dueAt.value = null;
      }
      priority.value = props.task.priority;
      selectedTagIds.value = props.task.tags.map((tag) => tag.id);
    } else {
      title.value = '';
      description.value = '';
      dueAt.value = null;
      priority.value = 'NONE';
      selectedTagIds.value = [];
    }
    descriptionMode.value = description.value.trim() ? 'preview' : 'edit';
    captureSnapshot();
  },
);

// -------------------------------------------------- Methods --------------------------------------------------

function captureSnapshot(): void {
  snapshot.value = {
    title: title.value,
    description: description.value,
    dueAtIso: dueAt.value ? dueAt.value.toISOString() : null,
    priority: priority.value,
    tagIds: [...selectedTagIds.value],
  };
}

function discardChanges(): void {
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
}

function close(): void {
  emit('close');
}

function duePayload(): string | null {
  if (!dueAt.value) {
    return null;
  }
  return dueAt.value.toISOString();
}

async function save(): Promise<void> {
  if (!title.value.trim() || !effectiveListId.value) {
    return;
  }
  bSaving.value = true;
  try {
    if (props.task) {
      const updated = await tasksStore.updateTask(props.task.id, {
        title: title.value.trim(),
        description: description.value || null,
        dueDate: duePayload(),
        dueDateHasTime: !!dueAt.value,
        priority: priority.value,
        tagIds: selectedTagIds.value,
      });
      emit('saved', updated);
    } else {
      const created = await tasksStore.createTask({
        listId: effectiveListId.value,
        title: title.value.trim(),
        description: description.value || null,
        dueDate: duePayload(),
        dueDateHasTime: !!dueAt.value,
        priority: priority.value,
        parentTaskId: props.parentTaskId ?? null,
        tagIds: selectedTagIds.value,
      });
      emit('saved', created);
    }
    close();
  } finally {
    bSaving.value = false;
  }
}

async function onCreateTag(name: string): Promise<void> {
  const tag = await tagsStore.createTag({ name });
  selectedTagIds.value = [...selectedTagIds.value, tag.id];
}

function onOpenSubTask(task: Task): void {
  emit('openTask', task);
}

function priorityLabel(p: Priority): string {
  const keys: Record<Priority, string> = {
    NONE: 'priority.none',
    LOW: 'priority.low',
    MEDIUM: 'priority.medium',
    HIGH: 'priority.high',
    URGENT: 'priority.urgent',
  };
  return t(keys[p]);
}

function selectPriority(p: Priority): void {
  priority.value = p;
  bPriorityMenuOpen.value = false;
}

function onPriorityMenuDocumentClick(event: MouseEvent): void {
  if (!bPriorityMenuOpen.value || !priorityMenuRoot.value) {
    return;
  }
  if (!priorityMenuRoot.value.contains(event.target as Node)) {
    bPriorityMenuOpen.value = false;
  }
}

// -------------------------------------------------- Lifecycle --------------------------------------------------

onMounted(() => {
  document.addEventListener('click', onPriorityMenuDocumentClick);
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
              v-model="title"
              type="text"
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
                v-model="descriptionMode"
                :options="descriptionModeOptions"
                :aria-label="t('task.description')"
              />
            </div>
            <textarea
              v-if="descriptionMode === 'edit'"
              v-model="description"
              class="min-h-[200px] w-full resize-y font-mono text-sm leading-relaxed"
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
              :allow-open="true"
              embedded
              @open="onOpenSubTask"
            />
          </div>
        </div>
        <aside class="min-w-0 space-y-5 rounded-br-xl bg-bg/20 px-6 py-5">
          <!-- Priority -->
          <div class="field">
            <label
              class="label !mb-2 !text-[10px] !font-semibold !uppercase !tracking-wide !text-text-muted"
            >
              {{ t('task.priority') }}
            </label>
            <div ref="priorityMenuRoot" class="relative hidden md:block">
              <button
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
              class="!w-auto max-w-full min-w-[10rem] !rounded-lg md:hidden"
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
              <DateTimePicker v-model="dueAt" :placeholder="t('task.dueDate')" />
            </div>
            <span
              v-if="isTaskOverdue"
              class="w-fit rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive"
            >
              {{ t('task.overdue') }}
            </span>
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
              @create="onCreateTag"
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
