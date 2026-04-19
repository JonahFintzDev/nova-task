<script setup lang="ts">
// components
import TaskRow from '@/components/task/TaskRow.vue';

// types
import type { Task } from '@/@types/index';

// -------------------------------------------------- Props --------------------------------------------------
const props = defineProps<{
  task: Task;
  subtaskCount?: number;
}>();

// -------------------------------------------------- Emits --------------------------------------------------
defineEmits<{
  (event: 'toggleDone', task: Task): void;
  (event: 'open', task: Task): void;
  (event: 'delete', task: Task): void;
}>();
</script>

<template>
  <div class="grid-item">
    <div class="line" />
    <TaskRow
      :task="props.task"
      :subtask-count="props.subtaskCount"
      @toggle-done="$emit('toggleDone', $event)"
      @open="$emit('open', $event)"
      @delete="$emit('delete', $event)"
    />
  </div>
</template>
