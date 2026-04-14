<script setup lang="ts">
// node_modules
import { nextTick, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

// lib
import { fadeInElement } from '@/lib/gsap';

// stores
import { useAuthStore } from '@/stores/auth';

// -------------------------------------------------- Store --------------------------------------------------

const authStore = useAuthStore();
const router = useRouter();
const { t } = useI18n();

// -------------------------------------------------- Data --------------------------------------------------

const username = ref('');
const password = ref('');
const bLoading = ref(false);
const errorMessage = ref('');
const cardRef = ref<HTMLElement | null>(null);

onMounted(async () => {
  await nextTick();
  fadeInElement(cardRef.value);
});

// -------------------------------------------------- Methods --------------------------------------------------

async function submit(): Promise<void> {
  errorMessage.value = '';
  bLoading.value = true;
  try {
    await authStore.register(username.value.trim(), password.value);
    await router.push('/');
  } catch {
    errorMessage.value = t('auth.errorTaken');
  } finally {
    bLoading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-bg px-4">
    <div ref="cardRef" class="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-xl">
      <h1 class="mb-2 text-center text-xl font-semibold">{{ t('auth.setupTitle') }}</h1>
      <p class="mb-6 text-center text-sm text-text-muted">{{ t('auth.setupSubtitle') }}</p>
      <form class="space-y-4" @submit.prevent="submit">
        <div class="field">
          <label class="label">{{ t('auth.username') }}</label>
          <input v-model="username" type="text" autocomplete="username" required />
        </div>
        <div class="field">
          <label class="label">{{ t('auth.password') }}</label>
          <input v-model="password" type="password" autocomplete="new-password" required />
        </div>
        <p v-if="errorMessage" class="message is-error">{{ errorMessage }}</p>
        <button type="submit" class="button is-primary w-full" :disabled="bLoading">
          {{ t('auth.submitRegister') }}
        </button>
      </form>
    </div>
  </div>
</template>
