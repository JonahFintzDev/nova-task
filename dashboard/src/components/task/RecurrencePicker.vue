<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RecurringRule } from '@/@types/index';

// -------------------------------------------------- Props / Emits --------------------------------------------------
const props = defineProps<{
  rule: RecurringRule | null | undefined;
  taskId?: string;
}>();

const emit = defineEmits<{
  (event: 'update', rule: { frequency: RecurringRule['frequency']; interval: number } | null): void;
}>();

// -------------------------------------------------- State --------------------------------------------------
const { t } = useI18n();

const enabled = ref(false);
const frequency = ref<RecurringRule['frequency']>('weekly');
const interval = ref(1);

// Sync from prop
watch(
  () => props.rule,
  (rule) => {
    if (rule) {
      enabled.value = true;
      frequency.value = rule.frequency;
      interval.value = rule.interval;
    } else {
      enabled.value = false;
      frequency.value = 'weekly';
      interval.value = 1;
    }
  },
  { immediate: true },
);

// -------------------------------------------------- Computed --------------------------------------------------
const intervalLabel = computed(() => {
  if (interval.value === 1) {
    return t(`recurrence.freq.${frequency.value}`);
  }
  return `${interval.value} ${t(`recurrence.freqPlural.${frequency.value}`)}`;
});

const streak = computed(() => props.rule?.streak ?? 0);

// -------------------------------------------------- Methods --------------------------------------------------
const onToggle = (): void => {
  enabled.value = !enabled.value;
  emit('update', enabled.value ? { frequency: frequency.value, interval: interval.value } : null);
};

const onFrequencyChange = (f: RecurringRule['frequency']): void => {
  frequency.value = f;
  if (enabled.value) emit('update', { frequency: f, interval: interval.value });
};

const onIntervalChange = (n: number): void => {
  const clamped = Math.max(1, Math.min(365, n));
  interval.value = clamped;
  if (enabled.value) emit('update', { frequency: frequency.value, interval: clamped });
};
</script>

<template>
  <div class="space-y-3">
    <!-- Toggle row -->
    <div class="flex items-center justify-between gap-3">
      <span class="text-sm text-text-primary">{{ t('recurrence.repeat') }}</span>
      <button
        type="button"
        role="switch"
        :aria-checked="enabled"
        class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
        :class="enabled ? 'bg-primary' : 'bg-border'"
        @click="onToggle"
      >
        <span
          class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200"
          :class="enabled ? 'translate-x-4' : 'translate-x-0'"
        />
      </button>
    </div>

    <!-- Options (only visible when enabled) -->
    <template v-if="enabled">
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <span class="text-text-muted">{{ t('recurrence.every') }}</span>
        <input
          type="number"
          :value="interval"
          min="1"
          max="365"
          class="w-16 !h-9 !min-h-9 !max-h-9 !py-1 !text-sm"
          @change="onIntervalChange(Number(($event.target as HTMLInputElement).value))"
        />
        <select
          :value="frequency"
          class="!h-9 w-auto !min-h-9 !max-h-none !py-1 !pe-8 !text-sm"
          @change="onFrequencyChange(($event.target as HTMLSelectElement).value as RecurringRule['frequency'])"
        >
          <option value="daily">{{ t('recurrence.freqPlural.daily') }}</option>
          <option value="weekly">{{ t('recurrence.freqPlural.weekly') }}</option>
          <option value="monthly">{{ t('recurrence.freqPlural.monthly') }}</option>
          <option value="quarterly">{{ t('recurrence.freqPlural.quarterly') }}</option>
          <option value="yearly">{{ t('recurrence.freqPlural.yearly') }}</option>
        </select>
      </div>

      <!-- Summary -->
      <p class="text-xs text-text-muted">
        {{ t('recurrence.summary', { label: intervalLabel }) }}
      </p>

      <!-- Streak -->
      <div
        v-if="streak > 0"
        class="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5"
      >
        <span class="text-base leading-none">🔥</span>
        <span class="text-xs font-medium text-primary">
          {{ t('recurrence.streak', { n: streak }) }}
        </span>
      </div>
    </template>
  </div>
</template>
