<script setup lang="ts">
// node_modules
import { CheckCircle2, Circle } from 'lucide-vue-next';
import { nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

// stores
import { useTasksStore } from '@/stores/tasks';

// types
import type { Task } from '@/@types/index';

// -------------------------------------------------- Props --------------------------------------------------
const props = defineProps<{
  task: Task;
  depth: number;
}>();

// -------------------------------------------------- Emits --------------------------------------------------
const { t } = useI18n();
const tasksStore = useTasksStore();
const isEditing = ref(false);
const draftTitle = ref(props.task.title);
const inputRef = ref<HTMLInputElement | null>(null);

const emit = defineEmits<{
  (event: 'toggleDone', task: Task): void;
  (event: 'delete', task: Task): void;
}>();

watch(
  () => props.task.title,
  (nextTitle) => {
    if (!isEditing.value) {
      draftTitle.value = nextTitle;
    }
  },
);

const startInlineEdit = async (): Promise<void> => {
  isEditing.value = true;
  draftTitle.value = props.task.title;
  await nextTick();
  inputRef.value?.focus();
  inputRef.value?.select();
};

const cancelInlineEdit = (): void => {
  isEditing.value = false;
  draftTitle.value = props.task.title;
};

const saveInlineEdit = async (): Promise<void> => {
  const trimmed = draftTitle.value.trim();
  if (!trimmed) {
    cancelInlineEdit();
    return;
  }
  if (trimmed !== props.task.title) {
    await tasksStore.updateTask(props.task.id, { title: trimmed });
  }
  isEditing.value = false;
};

const onInlineTitleKeyup = (e: KeyboardEvent): void => {
  if (e.key !== 'Enter' || e.isComposing) {
    return;
  }
  e.preventDefault();
  void saveInlineEdit();
};
</script>

<template>
  <div
    class="flex items-center gap-1.5 py-0.5"
    :style="{ paddingLeft: `${4 + depth * 14}px` }"
  >
    <button
      type="button"
      class="button is-icon is-transparent !h-6 !w-6 shrink-0 text-text-muted hover:text-text-primary"
      :title="props.task.done ? t('task.undone') : t('task.done')"
      @click.stop="emit('toggleDone', props.task)"
    >
      <CheckCircle2 v-if="props.task.done" class="h-4 w-4 text-primary" />
      <Circle v-else class="h-4 w-4" />
    </button>
    <div
      class="min-w-0 flex-1"
      @click="startInlineEdit"
    >
      <input
        v-if="isEditing"
        ref="inputRef"
        v-model="draftTitle"
        type="text"
        class="subtask-inline-input w-full"
        @click.stop
        @keyup="onInlineTitleKeyup"
        @keydown.esc.prevent="cancelInlineEdit"
        @blur="saveInlineEdit"
      />
      <div v-else class="cursor-text text-sm leading-none" :class="props.task.done ? 'line-through opacity-60' : ''">
        {{ props.task.title }}
      </div>
    </div>
    <button
      type="button"
      class="button is-transparent is-icon !h-6 !w-6 text-xs text-text-muted hover:text-text-primary"
      @click="emit('delete', props.task)"
    >
      ×
    </button>
  </div>
</template>

<style scoped>
.subtask-inline-input {
  appearance: none;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  outline: none !important;
  margin: 0 !important;
  padding: 0 !important;
  min-height: 0 !important;
  height: 1.25rem !important;
  line-height: 1.25rem !important;
  font-size: 0.875rem !important;
}

.subtask-inline-input:focus {
  border: 0 !important;
  box-shadow: none !important;
  outline: none !important;
}
</style>
