<script setup lang="ts">
// node_modules
import { useI18n } from 'vue-i18n';

// lib
import { priorityBadgeClass, priorityLabel } from '@/lib/utils';

// types
import type { Priority } from '@/@types/index';

// -------------------------------------------------- Props --------------------------------------------------

const props = defineProps<{
  priority: Priority;
}>();

const { t } = useI18n();
</script>

<template>
  <span
    v-if="props.priority !== 'NONE'"
    class="inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
    :class="priorityBadgeClass(props.priority)"
  >
    {{ priorityLabel(props.priority, t) }}
  </span>
</template>
