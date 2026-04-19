<script setup lang="ts">
// -------------------------------------------------- Props --------------------------------------------------
defineProps<{
  narrow?: boolean;
}>();
</script>

<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-6 md:px-8" :class="{ 'max-w-3xl': narrow }">
    <slot />
  </div>
</template>
