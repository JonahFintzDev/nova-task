<script setup lang="ts">
// node_modules
import { CheckCircle2, Circle, GripVertical, MoreVertical } from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

// lib
import { priorityLabel } from '@/lib/utils';

// components
import DueDateBadge from '@/components/task/DueDateBadge.vue';
import TagChip from '@/components/task/TagChip.vue';

// types
import type { Task } from '@/@types/index';

// -------------------------------------------------- Props --------------------------------------------------

const props = defineProps<{
  task: Task;
  subtaskCount?: number;
  showDragHandle?: boolean;
}>();

// -------------------------------------------------- Emits --------------------------------------------------

const emit = defineEmits<{
  (event: 'toggleDone', task: Task): void;
  (event: 'open', task: Task): void;
  (event: 'delete', task: Task): void;
}>();

// -------------------------------------------------- Data --------------------------------------------------

const { t } = useI18n();
const bMenuOpen = ref(false);
const menuRoot = ref<HTMLElement | null>(null);

// -------------------------------------------------- Computed --------------------------------------------------

const priorityText = computed(() => {
  if (!props.task.priority || props.task.priority === 'NONE') {
    return '';
  }
  return priorityLabel(props.task.priority, t);
});

const subtitleText = computed(() => {
  const parts: string[] = [];
  if (priorityText.value) {
    parts.push(`${t('task.priority')}: ${priorityText.value}`);
  }
  if (props.task.tags?.length) {
    parts.push(props.task.tags[0]!.name);
  }
  return parts.join(' • ');
});

// -------------------------------------------------- Methods --------------------------------------------------

function onRowClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  if (target.closest('button')) {
    return;
  }
  emit('open', props.task);
}

function onDocumentClick(event: MouseEvent): void {
  if (!bMenuOpen.value || !menuRoot.value) {
    return;
  }
  if (!menuRoot.value.contains(event.target as Node)) {
    bMenuOpen.value = false;
  }
}

function onEdit(): void {
  bMenuOpen.value = false;
  emit('open', props.task);
}

function onDelete(): void {
  bMenuOpen.value = false;
  emit('delete', props.task);
}

// -------------------------------------------------- Lifecycle --------------------------------------------------

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
});

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick);
});
</script>

<template>
  <div
    class="task-row flex w-full min-w-0 cursor-pointer flex-row items-center gap-3 px-4 py-3 transition-opacity"
    :class="props.task.done ? 'opacity-60' : ''"
    @click="onRowClick"
  >
    <!-- Drag handle (inside card) -->
    <span
      v-if="showDragHandle && !props.task.done"
      class="drag-handle flex shrink-0 cursor-grab select-none items-center justify-center text-text-muted/40 hover:text-text-muted"
    >
      <GripVertical class="h-4 w-4" />
    </span>

    <!-- Checkbox -->
    <button
      type="button"
      class="button is-icon is-transparent shrink-0 text-text-muted hover:text-primary"
      :title="props.task.done ? t('task.undone') : t('task.done')"
      @click.stop="emit('toggleDone', props.task)"
    >
      <CheckCircle2 v-if="props.task.done" class="h-5 w-5 text-primary" />
      <Circle v-else class="h-5 w-5" />
    </button>

    <!-- Content -->
    <div class="min-w-0 flex-1 space-y-0.5">
      <div
        class="font-semibold text-text-primary"
        :class="props.task.done ? 'line-through text-text-muted' : ''"
      >
        {{ props.task.title }}
      </div>
      <!-- Subtitle: Priority • Tag -->
      <div v-if="subtitleText && !props.task.done" class="text-xs text-text-muted">
        {{ subtitleText }}
      </div>
      <!-- Tags (done state) -->
      <div v-if="props.task.tags?.length && props.task.done" class="flex flex-wrap gap-1">
        <TagChip v-for="tag in props.task.tags" :key="tag.id" :tag="tag" />
      </div>
      <!-- Due date badge -->
      <div v-if="!props.task.done && props.task.dueDate" class="flex flex-wrap items-center gap-2">
        <DueDateBadge
          :due-date="props.task.dueDate"
          :due-date-has-time="props.task.dueDateHasTime"
          :done="props.task.done"
        />
        <span
          v-if="subtaskCount && subtaskCount > 0"
          class="rounded-full border border-border px-2 py-0.5 text-[10px] text-text-muted"
        >
          {{ subtaskCount }}
        </span>
      </div>
    </div>

    <!-- Right: URGENT badge + actions -->
    <div
      v-if="!props.task.done"
      ref="menuRoot"
      class="relative flex shrink-0 items-center gap-1.5"
    >
      <!-- URGENT badge -->
      <span
        v-if="props.task.priority === 'URGENT'"
        class="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning"
      >
        {{ t('priority.urgent') }}
      </span>

      <!-- Drag dots (when no explicit drag handle prop) -->
      <span
        v-if="!showDragHandle"
        class="drag-handle flex shrink-0 cursor-grab select-none items-center justify-center text-text-muted/30 hover:text-text-muted"
      >
        <GripVertical class="h-4 w-4" />
      </span>

      <!-- More menu -->
      <button
        type="button"
        class="button is-icon is-transparent !h-8 !w-8 !min-h-8 !min-w-8 text-text-muted/50 hover:text-text-muted"
        @click.stop="bMenuOpen = !bMenuOpen"
      >
        <MoreVertical class="h-4 w-4" />
      </button>
      <div
        v-if="bMenuOpen"
        class="absolute right-0 top-full z-20 mt-1 min-w-44 rounded-xl border border-border bg-surface py-1 shadow-lg"
        @click.stop
      >
        <button
          type="button"
          class="block w-full px-3 py-2 text-left text-sm hover:bg-fg/[0.05]"
          @click="onEdit"
        >
          {{ t('common.edit') }}
        </button>
        <button
          type="button"
          class="block w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
          @click="onDelete"
        >
          {{ t('common.delete') }}
        </button>
      </div>
    </div>
  </div>
</template>
