<script setup lang="ts">
// node_modules
import { useI18n } from 'vue-i18n';

// types
import type { List } from '@/@types/index';

// -------------------------------------------------- Props --------------------------------------------------
const props = defineProps<{
  list: List;
}>();

// -------------------------------------------------- Emits --------------------------------------------------
defineEmits<{
  (event: 'click', list: List): void;
}>();

const { t } = useI18n();
</script>

<template>
  <button
    type="button"
    class="grid-item w-full text-left"
    @click="$emit('click', props.list)"
  >
    <span
      class="line block w-1 shrink-0 rounded-full"
      :style="{ background: props.list.color ?? 'var(--color-border)' }"
    />
    <div class="top flex items-center gap-3 p-3">
      <span v-if="props.list.icon" class="material-icons text-primary">{{ props.list.icon }}</span>
      <div class="min-w-0 flex-1">
        <div class="title truncate">{{ props.list.title }}</div>
        <div class="subtitle text-xs text-text-muted">
          <span v-if="props.list.category">{{ props.list.category }} · </span>
          {{ t('list.taskCount', { n: props.list.taskCount ?? 0 }) }}
          <span v-if="props.list.doneCount"> · {{ t('list.doneCount', { n: props.list.doneCount }) }}</span>
        </div>
      </div>
    </div>
  </button>
</template>
