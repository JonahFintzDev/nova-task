<script setup lang="ts">
// node_modules
import { X } from 'lucide-vue-next';

// components
import GsapModal from '@/components/shared/GsapModal.vue';

// -------------------------------------------------- Props --------------------------------------------------

const props = defineProps<{
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
}>();

// -------------------------------------------------- Emits --------------------------------------------------

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'confirm'): void;
}>();

// -------------------------------------------------- Methods --------------------------------------------------

function onConfirm(): void {
  emit('confirm');
}
</script>

<template>
  <GsapModal :show="props.isOpen">
    <div class="modal-backdrop" @click="emit('close')" />
    <div class="modal-panel max-w-md">
      <div class="modal-header">
        <span>{{ props.title }}</span>
        <button type="button" class="close-button" aria-label="close" @click="emit('close')">
          <X class="h-5 w-5" />
        </button>
      </div>
      <div class="modal-body">
        <p class="text-sm text-text-muted">{{ props.message }}</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="button" @click="emit('close')">Cancel</button>
        <button
          type="button"
          class="button"
          :class="props.destructive ? 'is-destructive' : 'is-primary'"
          @click="onConfirm"
        >
          {{ props.confirmLabel ?? 'OK' }}
        </button>
      </div>
    </div>
  </GsapModal>
</template>
