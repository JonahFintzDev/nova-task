<script setup lang="ts">
// node_modules
import { ref, watch } from 'vue';
import { SwatchesPicker } from 'vue-color';

// -------------------------------------------------- Props --------------------------------------------------

const props = defineProps<{
  modelValue: string | null;
}>();

// -------------------------------------------------- Emits --------------------------------------------------

const emit = defineEmits<{
  (event: 'update:modelValue', value: string | null): void;
}>();

// -------------------------------------------------- Data --------------------------------------------------

const palette = [
  ['#0f172a', '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8'],
  ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'],
  ['#4338ca', '#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'],
  ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'],
  ['#be123c', '#e11d48', '#f43f5e', '#fb7185', '#fda4af', '#fecdd3'],
  ['#b91c1c', '#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca'],
  ['#c2410c', '#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa'],
  ['#a16207', '#ca8a04', '#eab308', '#facc15', '#fde047', '#fef08a'],
  ['#15803d', '#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0'],
  ['#0f766e', '#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4'],
];
const swatchColor = ref(props.modelValue ?? '#4f46e5');

// -------------------------------------------------- Watchers --------------------------------------------------

watch(
  () => props.modelValue,
  (value) => {
    if (value) {
      swatchColor.value = value;
    }
  },
);

// -------------------------------------------------- Methods --------------------------------------------------

function onSwatchPick(value: string): void {
  swatchColor.value = value;
  emit('update:modelValue', value);
}
</script>

<template>
  <div>
    <div class="rounded-xl border border-border bg-bg p-4!">
      <SwatchesPicker
        v-model="swatchColor"
        :palette="palette"
        class="app-swatches-picker"
        @update:modelValue="onSwatchPick"
      />
    </div>
  </div>
</template>

<style scoped>
:deep(.app-swatches-picker.vc-swatches-picker) {
  --vc-picker-bg: transparent;
  --vc-body-bg: transparent;
  --vc-swatch-border-radius: 6px;
  padding: 0;
  box-shadow: none;
  width: 100%;
  height: auto;
  padding: 0px !important;
  .box {
    padding: 0px !important;
    border: none !important;
    width: 100% !important;
  }

  overflow: hidden;
}

:deep(.app-swatches-picker.vc-swatches-picker) {
  display: block !important;
  width: 100% !important;
  max-width: none !important;
}
:deep(.app-swatches-picker .box) {
  width: 100% !important;
  padding: 0 !important;
  margin: 0 !important;
  box-sizing: border-box !important;
  display: grid;
  /* min 40 px*/
  grid-template-columns: repeat(10, minmax(40px, 100px));
  gap: 0.5rem !important;
  border: none !important;
  width: 100% !important;
  height: 100% !important;
  box-sizing: border-box !important;

  @media (max-width: 768px) {
    grid-template-columns: repeat(5, minmax(40px, 100px));
  }
  @media (max-width: 480px) {
    grid-template-columns: repeat(3, minmax(40px, 100px));
  }
}

:deep(.app-swatches-picker .colorGroup) {
  margin: 0 !important;
  flex: 1;
  padding: 0 !important;
  width: 100%;
}
:deep(.app-swatches-picker .colorGroup .color) {
  width: 100%;
  min-width: 40px;
}
</style>
