<script setup lang="ts">
// node_modules
import { AlertCircle } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

// lib
import { formatDueDate, isDueSoon, isDueToday, isOverdue } from '@/lib/utils';

// -------------------------------------------------- Props --------------------------------------------------
const props = defineProps<{
  dueDate: string | null;
  dueDateHasTime: boolean;
  done: boolean;
}>();

const { locale } = useI18n();

// -------------------------------------------------- Computed --------------------------------------------------
const label = computed(() => formatDueDate(props.dueDate, props.dueDateHasTime, locale.value));

const badgeClass = computed(() => {
  if (!props.dueDate || props.done) {
    return 'text-text-muted';
  }
  if (isOverdue(props.dueDate, props.done)) {
    return 'text-destructive';
  }
  if (isDueToday(props.dueDate)) {
    return 'text-warning';
  }
  if (isDueSoon(props.dueDate, 3)) {
    return 'text-primary';
  }
  return 'text-text-muted';
});
</script>

<template>
  <span
    v-if="props.dueDate"
    class="inline-flex items-center gap-1 text-xs"
    :class="badgeClass"
  >
    <AlertCircle v-if="isOverdue(props.dueDate, props.done)" class="h-3.5 w-3.5 shrink-0" />
    {{ label }}
  </span>
</template>
