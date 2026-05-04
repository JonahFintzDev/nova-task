<script setup lang="ts">
// node_modules
import { computed } from 'vue';

// classes
import { useDataTheme } from '@/composables/useDataTheme';
import { tagPillStyles } from '@/lib/tagColors';

// types
import type { Tag } from '@/@types/index';

// -------------------------------------------------- Props --------------------------------------------------
const props = defineProps<{
  tag: Tag;
}>();

// -------------------------------------------------- Store --------------------------------------------------
const themeMode = useDataTheme();

// -------------------------------------------------- Computed --------------------------------------------------
const pillStyle = computed(() => tagPillStyles(props.tag, themeMode.value));
</script>

<template>
  <span
    class="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium"
    :style="pillStyle"
  >
    {{ props.tag.name }}
  </span>
</template>
