<script setup lang="ts">
// node_modules
import { nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

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

async function submit(): Promise<void> {
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
}
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-bg px-4">
    <div ref="cardRef" class="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-xl">
      <h1 class="mb-6 text-center text-xl font-semibold">{{ t('auth.login') }}</h1>
      <div
        v-if="bRegistrationEnabled"
        class="mb-4 flex justify-center"
      >
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
          <input v-model="username" type="text" autocomplete="username" required />
        </div>
        <div class="field">
          <label class="label">{{ t('auth.password') }}</label>
          <input v-model="password" type="password" autocomplete="current-password" required />
        </div>
        <p v-if="errorMessage" class="message is-error">{{ errorMessage }}</p>
        <button type="submit" class="button is-primary w-full" :disabled="bLoading">
          {{ bRegisterMode ? t('auth.submitRegister') : t('auth.submitLogin') }}
        </button>
      </form>
    </div>
  </div>
</template>
