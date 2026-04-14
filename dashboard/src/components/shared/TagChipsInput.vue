<script setup lang="ts">
// node_modules
import { computed, ref } from 'vue';

import { useDataTheme } from '@/composables/useDataTheme';
import { tagPillStyles, tagSuggestionStyles } from '@/lib/tagColors';

// types
import type { Tag } from '@/@types/index';

// -------------------------------------------------- Props --------------------------------------------------

const props = defineProps<{
  modelValue: string[];
  allTags: Tag[];
}>();

// -------------------------------------------------- Emits --------------------------------------------------

const emit = defineEmits<{
  (event: 'update:modelValue', value: string[]): void;
  (event: 'create', name: string): void;
}>();

// -------------------------------------------------- Data --------------------------------------------------

const input = ref('');
const themeMode = useDataTheme();

// -------------------------------------------------- Computed --------------------------------------------------

const selectedTags = computed(() => {
  return props.allTags.filter((tag) => props.modelValue.includes(tag.id));
});

const suggestions = computed(() => {
  const term = input.value.trim().toLowerCase();
  if (!term) {
    return props.allTags.filter((tag) => !props.modelValue.includes(tag.id)).slice(0, 8);
  }
  return props.allTags.filter(
    (tag) =>
      !props.modelValue.includes(tag.id) && tag.name.toLowerCase().includes(term),
  );
});

// -------------------------------------------------- Methods --------------------------------------------------

function addTagId(tagId: string): void {
  if (props.modelValue.includes(tagId)) {
    return;
  }
  emit('update:modelValue', [...props.modelValue, tagId]);
  input.value = '';
}

function removeTagId(tagId: string): void {
  emit(
    'update:modelValue',
    props.modelValue.filter((id) => id !== tagId),
  );
}

function pillStyle(tag: Tag): Record<string, string> {
  return tagPillStyles(tag, themeMode.value);
}

function suggestionStyle(tag: Tag): Record<string, string> {
  return tagSuggestionStyles(tag, themeMode.value);
}

function onEnter(): void {
  const term = input.value.trim();
  if (!term) {
    return;
  }
  const existing = props.allTags.find((tag) => tag.name.toLowerCase() === term.toLowerCase());
  if (existing) {
    addTagId(existing.id);
    return;
  }
  emit('create', term);
  input.value = '';
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex flex-wrap gap-1">
      <span
        v-for="tag in selectedTags"
        :key="tag.id"
        class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
        :style="pillStyle(tag)"
      >
        {{ tag.name }}
        <button
          type="button"
          class="opacity-70 hover:opacity-100"
          style="color: inherit"
          @click="removeTagId(tag.id)"
        >
          ×
        </button>
      </span>
    </div>
    <input
      v-model="input"
      type="text"
      :placeholder="'Tag…'"
      @keydown.enter.prevent="onEnter"
    />
    <div v-if="suggestions.length" class="flex flex-wrap gap-1 text-xs">
      <button
        v-for="tag in suggestions"
        :key="tag.id"
        type="button"
        class="rounded-md border px-2 py-0.5 hover:brightness-110"
        :style="suggestionStyle(tag)"
        @click="addTagId(tag.id)"
      >
        {{ tag.name }}
      </button>
    </div>
  </div>
</template>
