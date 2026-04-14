<script setup lang="ts">
// node_modules
import { VueDatePicker } from '@vuepic/vue-datepicker';

const props = withDefaults(
  defineProps<{
    modelValue: Date | null;
    placeholder?: string;
    clearable?: boolean;
    autoApply?: boolean;
    is24?: boolean;
  }>(),
  {
    placeholder: '',
    clearable: true,
    autoApply: true,
    is24: true,
  },
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: Date | null): void;
}>();
</script>

<template>
  <VueDatePicker
    :model-value="props.modelValue"
    :is-24="props.is24"
    :auto-apply="props.autoApply"
    :clearable="props.clearable"
    :placeholder="props.placeholder"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>

<style scoped>
:deep(.dp__input) {
  border: 0 !important;
  box-shadow: none !important;
}

:deep(.dp__input:hover),
:deep(.dp__input_focus),
:deep(.dp__input:focus) {
  border: 0 !important;
  box-shadow: none !important;
}
</style>

<style scoped>
:deep(.dp__input_wrap .dp__input) {
  padding-left: 36px !important;
}
</style>
