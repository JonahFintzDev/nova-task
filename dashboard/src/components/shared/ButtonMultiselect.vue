<script setup lang="ts">
// -------------------------------------------------- Types --------------------------------------------------
type MultiSelectOption = {
  value: string;
  label: string;
};

// -------------------------------------------------- Props --------------------------------------------------
const props = defineProps<{
  modelValue: string;
  options: MultiSelectOption[];
  ariaLabel?: string;
}>();

// -------------------------------------------------- Emits --------------------------------------------------
const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
}>();
</script>

<template>
  <div
    class="inline-flex max-w-full items-stretch gap-0.5 overflow-hidden rounded-md border border-border p-1"
    role="tablist"
    :aria-label="props.ariaLabel"
  >
    <button
      v-for="option in props.options"
      :key="option.value"
      type="button"
      class="flex h-7 min-h-7 max-h-7 min-w-0 w-fit items-center justify-center rounded px-4 text-xs font-medium transition-colors"
      :class="
        option.value === props.modelValue
          ? 'bg-primary/20 text-primary'
          : 'text-text-muted hover:text-text-primary'
      "
      role="tab"
      :aria-selected="option.value === props.modelValue"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
