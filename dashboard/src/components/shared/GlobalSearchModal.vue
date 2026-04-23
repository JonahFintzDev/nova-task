<script setup lang="ts">
// node_modules
import { Loader2, Search, X } from 'lucide-vue-next';
import { nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

// components
import GsapModal from '@/components/shared/GsapModal.vue';
import ListCard from '@/components/list/ListCard.vue';

// classes
import { searchApi } from '@/classes/api';

// types
import type { List, Task } from '@/@types/index';

// -------------------------------------------------- Props --------------------------------------------------
const props = defineProps<{
  isOpen: boolean;
}>();

// -------------------------------------------------- Emits --------------------------------------------------
const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'openTask', task: Task): void;
}>();

// -------------------------------------------------- Store / router --------------------------------------------------
const router = useRouter();
const { t } = useI18n();

// -------------------------------------------------- Data --------------------------------------------------
const query = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);
const bLoading = ref(false);
const lists = ref<List[]>([]);
const tasks = ref<Task[]>([]);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let searchSeq = 0;

// -------------------------------------------------- Watchers --------------------------------------------------
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      query.value = '';
      lists.value = [];
      tasks.value = [];
      void focusSearchInput();
    }
  },
);

watch(query, (value) => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  const term = value.trim();
  if (term.length < 1) {
    bLoading.value = false;
    lists.value = [];
    tasks.value = [];
    return;
  }
  bLoading.value = true;
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runSearch(value);
  }, 300);
});

// -------------------------------------------------- Methods --------------------------------------------------
const runSearch = async (value: string): Promise<void> => {
  const term = value.trim();
  if (term.length < 1) {
    lists.value = [];
    tasks.value = [];
    bLoading.value = false;
    return;
  }
  const seq = ++searchSeq;
  try {
    const result = await searchApi.search(term);
    if (seq !== searchSeq || query.value.trim() !== term) {
      return;
    }
    lists.value = result.lists;
    tasks.value = result.tasks;
  } finally {
    if (seq === searchSeq) {
      bLoading.value = false;
    }
  }
};

const goList = (list: List): void => {
  emit('close');
  void router.push({ name: 'list', params: { id: list.id } });
};

const openTask = (task: Task): void => {
  emit('close');
  emit('openTask', task);
};

const focusSearchInput = async (): Promise<void> => {
  await nextTick();
  searchInputRef.value?.focus();
  searchInputRef.value?.select();
  window.setTimeout(() => {
    searchInputRef.value?.focus();
  }, 120);
};
</script>

<template>
  <GsapModal :show="props.isOpen" class="z-[60]">
    <div class="modal-backdrop" @click="emit('close')" />
    <div class="modal-panel max-w-2xl">
      <div class="modal-header">
        <span>{{ t('search.title') }}</span>
        <button type="button" class="close-button" @click="emit('close')">
          <X class="h-5 w-5" />
        </button>
      </div>
      <div class="modal-body space-y-4">
        <div class="field">
          <div class="input-wrap">
            <Search class="icon ms-1 h-4 w-4" />
            <input
              ref="searchInputRef"
              v-model="query"
              type="search"
              :placeholder="t('search.placeholder')"
              autofocus
            />
          </div>
        </div>
        <div
          v-if="bLoading"
          class="flex items-center gap-2 py-6 text-sm text-text-muted"
          role="status"
          aria-live="polite"
        >
          <Loader2 class="h-5 w-5 shrink-0 animate-spin text-primary" />
          <span>{{ t('search.loading') }}</span>
        </div>
        <template v-else>
          <div v-if="lists.length">
            <h3 class="mb-2 text-xs font-semibold uppercase text-text-muted">
              {{ t('search.lists') }}
            </h3>
            <div class="grid-view">
              <div class="grid-view-items">
                <ListCard v-for="list in lists" :key="list.id" :list="list" @click="goList" />
              </div>
            </div>
          </div>
          <div v-if="tasks.length">
            <h3 class="mb-2 text-xs font-semibold uppercase text-text-muted">
              {{ t('search.tasks') }}
            </h3>
            <ul class="space-y-1">
              <li
                v-for="task in tasks"
                :key="task.id"
                class="cursor-pointer rounded-md border border-border px-3 py-2 text-sm hover:border-primary"
                @click="openTask(task)"
              >
                <div class="font-medium">{{ task.title }}</div>
                <div v-if="task.list" class="text-xs text-text-muted">{{ task.list.title }}</div>
              </li>
            </ul>
          </div>
          <p
            v-if="!bLoading && query.trim() && !lists.length && !tasks.length"
            class="mx-auto max-w-md text-center text-sm leading-relaxed text-text-muted"
          >
            {{ t('search.empty') }}
          </p>
        </template>
      </div>
    </div>
  </GsapModal>
</template>
