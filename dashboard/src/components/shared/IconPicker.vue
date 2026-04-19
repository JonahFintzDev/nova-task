<script setup lang="ts">
// node_modules
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

// data
import { googleIcons } from '@/data/googleMaterialIcons';

// -------------------------------------------------- Const --------------------------------------------------
// Common, valid Material icon names for list defaults.
const defaultIconCandidates: string[] = [
  'home',
  'work',
  'shopping_cart',
  'flight',
  'restaurant',
  'health_and_safety',
  'account_balance_wallet',
  'school',
  'movie',
  'category',
  'fitness_center',
  'pets',
  'local_library',
  'directions_car',
  'event',
  'build',
  'music_note',
  'star',
];
const iconSet = new Set(googleIcons);
const defaultIcons = defaultIconCandidates.filter((icon) => iconSet.has(icon));
// -------------------------------------------------- Props --------------------------------------------------
defineProps<{
  modelValue: string | null;
}>();

// -------------------------------------------------- Emits --------------------------------------------------
const emit = defineEmits<{
  (event: 'update:modelValue', value: string | null): void;
}>();

// -------------------------------------------------- Data --------------------------------------------------
const { t } = useI18n();
const filter = ref('');

// -------------------------------------------------- Computed --------------------------------------------------
const filtered = computed(() => {
  const term = filter.value.trim().toLowerCase();
  if (!term) {
    return defaultIcons;
  }
  return googleIcons.filter((icon) => icon.toLowerCase().includes(term));
});

// -------------------------------------------------- Methods --------------------------------------------------
const pick = (icon: string): void => {
  emit('update:modelValue', icon);
};

const clear = (): void => {
  emit('update:modelValue', null);
};
</script>

<template>
  <div class="space-y-3">
    <input
      v-model="filter"
      type="search"
      :placeholder="t('list.iconFilterPlaceholder')"
      class="!h-9 !rounded-lg !border-0 !bg-bg !px-4 !text-sm"
    />
    <p
      v-if="filtered.length === 0"
      class="rounded-md border border-border bg-input py-6 text-center text-sm text-text-muted"
    >
      {{ t('list.iconNoResults') }}
    </p>
    <div v-else class="flex flex-wrap gap-2">
      <button
        v-for="icon in filtered.slice(0, 18)"
        :key="icon"
        type="button"
        class="flex h-12 w-12 items-center justify-center rounded-md border border-transparent bg-bg text-text-muted transition-all hover:border-primary/40 hover:text-text-primary"
        :class="modelValue === icon ? '!bg-primary !text-white shadow-sm' : ''"
        :title="icon"
        @click="pick(icon)"
      >
        <span class="material-icons !text-2xl">{{ icon }}</span>
      </button>
      <button
        v-if="modelValue"
        type="button"
        class="ms-1 text-xs text-text-muted transition-colors hover:text-text-primary"
        @click="clear"
      >
        {{ t('list.iconClear') }}
      </button>
    </div>
  </div>
</template>
