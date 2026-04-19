<script setup lang="ts">
// node_modules
import { useAttrs } from 'vue';

// api
import { modalTransitionEnter, modalTransitionLeave } from '@/lib/gsap';

// -------------------------------------------------- Props --------------------------------------------------
defineOptions({ inheritAttrs: false });
withDefaults(
  defineProps<{
    show: boolean;
    /** When false, modal stays in DOM order (e.g. under PageShell) instead of body. */
    teleport?: boolean;
  }>(),
  { teleport: true },
);

// -------------------------------------------------- Refs --------------------------------------------------
const attrs = useAttrs();
</script>

<template>
  <Teleport to="body" :disabled="!teleport">
    <Transition name="gsap-modal" :css="false" @enter="modalTransitionEnter" @leave="modalTransitionLeave">
      <div v-if="show" class="modal-wrap" v-bind="attrs">
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>
