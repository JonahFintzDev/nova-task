<script setup lang="ts">
// node_modules
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

// components
import SubTaskRow from '@/components/task/SubTaskRow.vue';

// stores
import { useTasksStore } from '@/stores/tasks';

// types
import type { Task } from '@/@types/index';

defineOptions({ name: 'SubTaskList' });

// -------------------------------------------------- Props --------------------------------------------------

const props = defineProps<{
  parentTask: Task;
  listId: string;
  depth: number;
  allowOpen?: boolean;
  /** Tighter layout inside task modal (no top divider, compact add row). */
  embedded?: boolean;
}>();

// -------------------------------------------------- Emits --------------------------------------------------

defineEmits<{
  (event: 'open', task: Task): void;
}>();

// -------------------------------------------------- Data --------------------------------------------------

const tasksStore = useTasksStore();
const { t } = useI18n();
const newTitle = ref('');

const subtasks = computed(() => tasksStore.subTasksOf(props.parentTask.id));

// -------------------------------------------------- Methods --------------------------------------------------

async function addSubtask(): Promise<void> {
  const title = newTitle.value.trim();
  if (!title) {
    return;
  }
  await tasksStore.createTask({
    listId: props.listId,
    title,
    parentTaskId: props.parentTask.id,
  });
  newTitle.value = '';
}

async function onToggle(task: Task): Promise<void> {
  await tasksStore.toggleDone(task.id);
}

async function onDelete(task: Task): Promise<void> {
  await tasksStore.deleteTask(task.id);
}
</script>

<template>
  <div :class="depth === 0 ? (embedded ? 'pt-0' : 'border-t border-border/50 pt-2') : 'mt-1'">
    <template v-for="st in subtasks" :key="st.id">
      <SubTaskRow
        :task="st"
        :depth="depth"
        :allow-open="props.allowOpen !== false"
        @toggle-done="onToggle"
        @open="$emit('open', $event)"
        @delete="onDelete"
      />
    </template>
    <div
      v-if="depth === 0"
      class="mt-2 flex items-center gap-2"
      :style="{ paddingLeft: embedded ? '0' : `${16 + depth * 16}px` }"
    >
      <input
        v-model="newTitle"
        type="text"
        class="flex-1"
        :placeholder="embedded ? t('task.addSubtaskPlaceholder') : t('task.addSubtask')"
        @keydown.enter.prevent="addSubtask"
      />
      <span v-if="embedded" class="hidden shrink-0 text-[10px] font-medium uppercase tracking-wide text-text-muted sm:inline">
        {{ t('task.pressEnter') }}
      </span>
      <button
        v-else
        type="button"
        class="button is-primary shrink-0"
        @click="addSubtask"
      >
        {{ t('task.addSubtask') }}
      </button>
    </div>
  </div>
</template>
