<script setup lang="ts">
// node_modules
import { Loader2, Sparkles, X } from 'lucide-vue-next';
import { onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

// classes
import { aiApi, appWs } from '@/classes/api';

// types
import type { AiSuggestion } from '@/@types/index';

// -------------------------------------------------- Props / Emits --------------------------------------------------
const props = defineProps<{
  listId: string;
  /** When set, generates subtasks for this task — no prompt input shown. */
  taskId?: string;
  /** Used as the prompt in subtask mode. */
  taskTitle?: string;
}>();

const emit = defineEmits<{
  (e: 'add', titles: string[]): void;
}>();

// -------------------------------------------------- Data --------------------------------------------------
const { t } = useI18n();
const prompt = ref('');
const suggestions = ref<AiSuggestion[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const activeRequestId = ref<string | null>(null);

// -------------------------------------------------- WebSocket --------------------------------------------------
let unsubscribeWs: (() => void) | null = null;

onMounted(() => {
  unsubscribeWs = appWs.on((msg) => {
    if (
      msg.type === 'ai:chunk' &&
      msg.requestId === activeRequestId.value &&
      msg.listId === props.listId
    ) {
      suggestions.value.push({ id: crypto.randomUUID(), title: msg.title });
    } else if (msg.type === 'ai:done' && msg.requestId === activeRequestId.value) {
      isLoading.value = false;
      activeRequestId.value = null;
    } else if (msg.type === 'ai:error' && msg.requestId === activeRequestId.value) {
      error.value = msg.message;
      isLoading.value = false;
      activeRequestId.value = null;
    }
  });
});

onUnmounted(() => {
  unsubscribeWs?.();
});

// -------------------------------------------------- Methods --------------------------------------------------
const generate = async (): Promise<void> => {
  // In subtask mode use the task title as the prompt; in list mode use the typed prompt.
  const text = props.taskId ? (props.taskTitle ?? '').trim() : prompt.value.trim();
  if (!text || isLoading.value) return;

  error.value = null;
  suggestions.value = [];
  isLoading.value = true;

  try {
    const { requestId } = await aiApi.suggest(props.listId, text, props.taskId);
    activeRequestId.value = requestId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const axiosData = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
    error.value = axiosData ?? msg;
    isLoading.value = false;
  }
};

const removeSuggestion = (id: string): void => {
  suggestions.value = suggestions.value.filter((s) => s.id !== id);
};

const addAll = (): void => {
  if (!suggestions.value.length) return;
  emit('add', suggestions.value.map((s) => s.title));
  suggestions.value = [];
  if (!props.taskId) prompt.value = '';
};
</script>

<template>
  <div class="rounded-2xl border border-primary/20 bg-primary/5 p-4">
    <!-- Header -->
    <div class="mb-3 flex items-center gap-2">
      <Sparkles class="h-4 w-4 shrink-0 text-primary" />
      <span class="text-sm font-semibold text-text-primary">
        {{ taskId ? t('ai.subtaskTitle') : t('ai.title') }}
      </span>
    </div>

    <!-- Subtask mode: context hint + button -->
    <div v-if="taskId" class="flex items-center gap-3">
      <p class="flex-1 text-xs text-text-muted">{{ t('ai.subtaskContext') }}</p>
      <button
        type="button"
        class="button is-primary !rounded-xl shrink-0 px-4"
        :disabled="isLoading"
        @click="generate"
      >
        <Loader2 v-if="isLoading" class="h-4 w-4 animate-spin" />
        <Sparkles v-else class="h-4 w-4" />
        <span>{{ t('ai.generate') }}</span>
      </button>
    </div>

    <!-- List mode: prompt input + button -->
    <div v-else class="flex gap-2">
      <input
        v-model="prompt"
        type="text"
        :placeholder="t('ai.promptPlaceholder')"
        :disabled="isLoading"
        class="flex-1 !rounded-xl text-sm"
        @keydown.enter.prevent="generate"
      />
      <button
        type="button"
        class="button is-primary !rounded-xl shrink-0 px-4"
        :disabled="!prompt.trim() || isLoading"
        @click="generate"
      >
        <Loader2 v-if="isLoading" class="h-4 w-4 animate-spin" />
        <Sparkles v-else class="h-4 w-4" />
        <span>{{ t('ai.generate') }}</span>
      </button>
    </div>

    <!-- Error -->
    <p v-if="error" class="mt-2 text-xs text-destructive">{{ error }}</p>

    <!-- Suggestions list -->
    <div v-if="suggestions.length || isLoading" class="mt-3">
      <ul class="space-y-1.5">
        <li
          v-for="suggestion in suggestions"
          :key="suggestion.id"
          class="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
        >
          <span class="flex-1 text-sm text-text-primary">{{ suggestion.title }}</span>
          <button
            type="button"
            class="shrink-0 rounded p-0.5 text-text-muted hover:bg-destructive/10 hover:text-destructive"
            :title="t('common.delete')"
            @click="removeSuggestion(suggestion.id)"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </li>
        <!-- Streaming indicator -->
        <li v-if="isLoading" class="flex items-center gap-2 px-3 py-1.5">
          <Loader2 class="h-3.5 w-3.5 animate-spin text-text-muted" />
          <span class="text-xs text-text-muted">{{ t('ai.generating') }}</span>
        </li>
      </ul>

      <!-- Add all button -->
      <div v-if="suggestions.length && !isLoading" class="mt-3 flex justify-end">
        <button
          type="button"
          class="button is-primary !rounded-xl px-4 text-sm"
          @click="addAll"
        >
          {{ taskId ? t('ai.addAllSubtasks', { n: suggestions.length }) : t('ai.addAll', { n: suggestions.length }) }}
        </button>
      </div>
    </div>
  </div>
</template>
