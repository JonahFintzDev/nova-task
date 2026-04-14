<script setup lang="ts">
// node_modules
import { onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

// classes
import { getApiReachable, subscribeApiReachable } from '@/classes/api';

// -------------------------------------------------- Data --------------------------------------------------

const { t } = useI18n();
const bOnline = ref(getApiReachable());
let unsubscribe: (() => void) | null = null;

// -------------------------------------------------- Lifecycle --------------------------------------------------

onMounted(() => {
  unsubscribe = subscribeApiReachable((online) => {
    bOnline.value = online;
  });
});

onUnmounted(() => {
  unsubscribe?.();
});
</script>

<template>
  <div
    v-if="!bOnline"
    class="border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-sm text-warning"
    role="status"
  >
    {{ t('common.offline') }}
  </div>
</template>
