<script setup lang="ts">
// node_modules
import { nextTick, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { Lock, User, UserPlus } from 'lucide-vue-next';

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
const submit = async (): Promise<void> => {
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
};
</script>

<template>
  <div class="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg px-4">
    <!-- Gradient orb — top-right -->
    <div
      class="pointer-events-none absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full opacity-25"
      style="background: radial-gradient(circle, #4f46e5 0%, transparent 65%); filter: blur(48px);"
    />
    <!-- Gradient orb — bottom-left -->
    <div
      class="pointer-events-none absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full opacity-20"
      style="background: radial-gradient(circle, #7c3aed 0%, transparent 65%); filter: blur(60px);"
    />

    <div
      ref="cardRef"
      class="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-2xl"
    >
      <!-- Logo + brand -->
      <div class="mb-7 flex flex-col items-center gap-3">
        <img src="/icon.svg" alt="Nova Task logo" class="h-14 w-14 drop-shadow-sm" />
        <div class="text-center">
          <h1 class="text-2xl font-bold tracking-tight text-text-primary">{{ t('auth.setupTitle') }}</h1>
          <p class="mt-1 text-sm text-text-muted">{{ t('auth.setupSubtitle') }}</p>
        </div>
      </div>

      <form class="space-y-4" @submit.prevent="submit">
        <div class="field">
          <label class="label">{{ t('auth.username') }}</label>
          <div class="input-wrap">
            <span class="icon"><User :size="15" /></span>
            <input
              v-model="username"
              type="text"
              autocomplete="username"
              required
              :placeholder="t('auth.username')"
            />
          </div>
        </div>
        <div class="field">
          <label class="label">{{ t('auth.password') }}</label>
          <div class="input-wrap">
            <span class="icon"><Lock :size="15" /></span>
            <input
              v-model="password"
              type="password"
              autocomplete="new-password"
              required
              :placeholder="t('auth.password')"
            />
          </div>
        </div>
        <p v-if="errorMessage" class="message is-error">{{ errorMessage }}</p>
        <button type="submit" class="button is-primary w-full" :disabled="bLoading">
          <UserPlus :size="16" />
          {{ t('auth.submitRegister') }}
        </button>
      </form>
    </div>
  </div>
</template>
