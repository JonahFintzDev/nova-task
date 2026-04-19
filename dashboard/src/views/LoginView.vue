<script setup lang="ts">
// node_modules
import { nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Lock, LogIn, User, UserPlus } from 'lucide-vue-next';

// classes
import { healthApi } from '@/classes/api';

// lib
import { fadeInElement } from '@/lib/gsap';

// stores
import { useAuthStore } from '@/stores/auth';

// -------------------------------------------------- Store --------------------------------------------------
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const { t } = useI18n();

// -------------------------------------------------- Data --------------------------------------------------
const username = ref('');
const password = ref('');
const bRegisterMode = ref(false);
const bLoading = ref(false);
const errorMessage = ref('');
const bRegistrationEnabled = ref(true);
const cardRef = ref<HTMLElement | null>(null);

// -------------------------------------------------- Watchers --------------------------------------------------
watch(bRegistrationEnabled, (enabled) => {
  if (!enabled) {
    bRegisterMode.value = false;
  }
});

// -------------------------------------------------- Lifecycle --------------------------------------------------
onMounted(async () => {
  const health = await healthApi.check();
  bRegistrationEnabled.value = health.registrationEnabled;
  if (route.query['register'] === '1' && bRegistrationEnabled.value) {
    bRegisterMode.value = true;
  }
  await nextTick();
  fadeInElement(cardRef.value);
});

// -------------------------------------------------- Methods --------------------------------------------------
const submit = async (): Promise<void> => {
  errorMessage.value = '';
  bLoading.value = true;
  try {
    if (bRegisterMode.value) {
      await authStore.register(username.value.trim(), password.value);
    } else {
      await authStore.login(username.value.trim(), password.value);
    }
    const redirect = typeof route.query['redirect'] === 'string' ? route.query['redirect'] : '/';
    await router.push(redirect);
  } catch (error: unknown) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    errorMessage.value =
      response?.data?.error === 'Registration disabled'
        ? t('auth.registrationDisabled')
        : t('auth.errorInvalid');
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
          <h1 class="text-2xl font-bold tracking-tight text-text-primary">Nova Task</h1>
          <p class="mt-0.5 text-sm text-text-muted">Your personal task manager</p>
        </div>
      </div>

      <!-- Login / Register tab switcher -->
      <div v-if="bRegistrationEnabled" class="mb-5 flex justify-center">
        <div
          class="inline-flex flex-wrap items-stretch gap-0.5 rounded-md border border-border p-0.5"
        >
          <button
            type="button"
            class="button !h-9 !max-h-9 !min-h-9 shrink-0 border-0 px-4 py-0 text-sm"
            :class="!bRegisterMode ? 'is-primary' : 'is-transparent'"
            @click="bRegisterMode = false"
          >
            {{ t('auth.login') }}
          </button>
          <button
            type="button"
            class="button !h-9 !max-h-9 !min-h-9 shrink-0 border-0 px-4 py-0 text-sm"
            :class="bRegisterMode ? 'is-primary' : 'is-transparent'"
            @click="bRegisterMode = true"
          >
            {{ t('auth.register') }}
          </button>
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
              autocomplete="current-password"
              required
              :placeholder="t('auth.password')"
            />
          </div>
        </div>
        <p v-if="errorMessage" class="message is-error">{{ errorMessage }}</p>
        <button type="submit" class="button is-primary w-full" :disabled="bLoading">
          <LogIn v-if="!bRegisterMode" :size="16" />
          <UserPlus v-else :size="16" />
          {{ bRegisterMode ? t('auth.submitRegister') : t('auth.submitLogin') }}
        </button>
      </form>
    </div>
  </div>
</template>
