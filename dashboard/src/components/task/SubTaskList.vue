<script setup lang="ts">
// node_modules
import { Plus } from 'lucide-vue-next';
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
  /** Tighter layout inside task modal (no top divider, compact add row). */
  embedded?: boolean;
}>();

// -------------------------------------------------- Data --------------------------------------------------
const tasksStore = useTasksStore();
const { t } = useI18n();
const newTitle = ref('');

const subtasks = computed(() => tasksStore.subTasksOf(props.parentTask.id));

// -------------------------------------------------- Methods --------------------------------------------------
const addSubtask = async (): Promise<void> => {
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
};

/** keyup + Enter: mobile WebKit often skips keydown for the IME action key; avoid firing during IME composition. */
const onSubtaskAddKeyup = (e: KeyboardEvent): void => {
  if (e.key !== 'Enter' || e.isComposing) {
    return;
  }
  e.preventDefault();
  void addSubtask();
};

const onToggle = async (task: Task): Promise<void> => {
  await tasksStore.toggleDone(task.id);
};

const onDelete = async (task: Task): Promise<void> => {
  await tasksStore.deleteTask(task.id);
};
</script>

<template>
  <div :class="depth === 0 ? (embedded ? 'pt-0' : 'border-t border-border/50 pt-0.5') : 'mt-0.5'">
    <template v-for="st in subtasks" :key="st.id">
      <SubTaskRow
        :task="st"
        :depth="depth"
        @toggle-done="onToggle"
        @delete="onDelete"
      />
    </template>
    <div
      v-if="depth === 0"
      class="mt-0.5 flex items-center gap-1"
      :style="{ paddingLeft: embedded ? '0' : `${16 + depth * 16}px` }"
    >
      <input
        v-model="newTitle"
        type="search"
        autocomplete="off"
        class="min-w-0 flex-1 !min-h-0 !py-0.5 appearance-none [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
        enterkeyhint="done"
        :placeholder="embedded ? t('task.addSubtaskPlaceholder') : t('task.addSubtask')"
        @keyup="onSubtaskAddKeyup"
      />
      <button
        type="button"
        class="button is-primary is-icon !h-6.5 !w-6.5 shrink-0"
        :aria-label="t('task.addSubtask')"
        :title="t('task.addSubtask')"
        @click="addSubtask"
      >
        <Plus class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
