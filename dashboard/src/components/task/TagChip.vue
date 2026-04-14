<script setup lang="ts">
import { computed } from 'vue';

import { useDataTheme } from '@/composables/useDataTheme';
import { tagPillStyles } from '@/lib/tagColors';

// types
import type { Tag } from '@/@types/index';

// -------------------------------------------------- Props --------------------------------------------------

const props = defineProps<{
  tag: Tag;
}>();

const themeMode = useDataTheme();

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
