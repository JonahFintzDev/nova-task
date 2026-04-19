<script setup lang="ts">
// -------------------------------------------------- Props --------------------------------------------------
defineProps<{
  title: string;
}>();
</script>

<template>
  <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <h1 class="text-xl font-semibold text-text-primary md:text-2xl">{{ title }}</h1>
    <div class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
