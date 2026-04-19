<script setup lang="ts">
// node_modules
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

// classes
import { getApiReachable, subscribeApiReachable } from '@/classes/api';

// lib
import { pendingTaskMutations } from '@/lib/pwa-offline-tasks';

// -------------------------------------------------- Data --------------------------------------------------
const { t } = useI18n();
const bApiReachable = ref(getApiReachable());
const bBrowserOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);
let unsubscribeApi: (() => void) | null = null;

// -------------------------------------------------- Computed --------------------------------------------------
const bWorkingOffline = computed(() => !bBrowserOnline.value || !bApiReachable.value);

// -------------------------------------------------- Methods --------------------------------------------------
const onBrowserOffline = (): void => {
  bBrowserOnline.value = false;
};

const onBrowserOnline = (): void => {
  bBrowserOnline.value = true;
};

// -------------------------------------------------- Lifecycle --------------------------------------------------
onMounted(() => {
  unsubscribeApi = subscribeApiReachable((online) => {
    bApiReachable.value = online;
  });
  window.addEventListener('offline', onBrowserOffline);
  window.addEventListener('online', onBrowserOnline);
});

onUnmounted(() => {
  unsubscribeApi?.();
  window.removeEventListener('offline', onBrowserOffline);
  window.removeEventListener('online', onBrowserOnline);
});
</script>

<template>
  <div
    v-if="bWorkingOffline"
    class="flex flex-col gap-0.5 border-b border-border bg-muted/30 px-4 py-1.5 text-center text-xs text-text-muted"
    role="status"
  >
    <span>{{ t('common.offlineBannerTitle') }}</span>
    <span v-if="pendingTaskMutations > 0" class="text-[11px] text-text-muted/90">
      {{ t('common.offlinePendingSync', { n: pendingTaskMutations }) }}
    </span>
  </div>
</template>
