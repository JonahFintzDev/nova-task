<script setup lang="ts">
// node_modules
import { CheckCircle2, Circle } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

// components
import DueDateBadge from '@/components/task/DueDateBadge.vue';
import PriorityBadge from '@/components/task/PriorityBadge.vue';

// types
import type { Task } from '@/@types/index';

// -------------------------------------------------- Props --------------------------------------------------

const props = defineProps<{
  task: Task;
  depth: number;
  allowOpen?: boolean;
}>();

// -------------------------------------------------- Emits --------------------------------------------------

const { t } = useI18n();

const emit = defineEmits<{
  (event: 'toggleDone', task: Task): void;
  (event: 'open', task: Task): void;
  (event: 'delete', task: Task): void;
}>();

function onContentClick(): void {
  if (props.allowOpen === false) {
    return;
  }
  emit('open', props.task);
}
</script>

<template>
  <div
    class="mb-2 flex items-center gap-2 rounded-xl bg-fg/[0.04] px-2 py-2"
    :style="{ paddingLeft: `${8 + depth * 16}px` }"
  >
    <button
      type="button"
      class="button is-icon is-transparent shrink-0 text-text-muted hover:text-text-primary"
      :title="props.task.done ? t('task.undone') : t('task.done')"
      @click.stop="emit('toggleDone', props.task)"
    >
      <CheckCircle2 v-if="props.task.done" class="h-4 w-4 text-primary" />
      <Circle v-else class="h-4 w-4" />
    </button>
    <div
      class="min-w-0 flex-1"
      :class="props.allowOpen === false ? '' : 'cursor-pointer'"
      @click="onContentClick"
    >
      <div class="text-sm" :class="props.task.done ? 'line-through opacity-60' : ''">
        {{ props.task.title }}
      </div>
      <div class="mt-1 flex flex-wrap gap-2">
        <PriorityBadge :priority="props.task.priority" />
        <DueDateBadge
          :due-date="props.task.dueDate"
          :due-date-has-time="props.task.dueDateHasTime"
          :done="props.task.done"
        />
      </div>
    </div>
    <button type="button" class="button is-transparent is-icon text-xs" @click="emit('delete', props.task)">
      ×
    </button>
  </div>
</template>
