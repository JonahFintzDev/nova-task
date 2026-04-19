<script setup lang="ts">
// node_modules
import dayjs from 'dayjs';
import { nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterView } from 'vue-router';

// classes
import { fetchNeedsSetup } from '@/classes/router';
import { settingsApi } from '@/classes/api';

// lib
import { fadeInElement } from '@/lib/gsap';
import { applyUserThemePreferences, migrateLegacyThemeLocalStorage } from '@/lib/themes';
import { detectBrowserLocale, setLocale, type LocaleCode } from '@/lib/i18n';

// stores
import { useAuthStore } from '@/stores/auth';

// -------------------------------------------------- Data --------------------------------------------------
const bBooting = ref(true);
const authStore = useAuthStore();
const { t } = useI18n();
const appRoot = ref<HTMLElement | null>(null);

// -------------------------------------------------- Methods --------------------------------------------------
const applyGuestLocale = (): void => {
  const fallback = detectBrowserLocale();
  setLocale(fallback);
  dayjs.locale(fallback);
  applyUserThemePreferences({
    autoTheme: true,
    darkTheme: null,
    lightTheme: null,
  });
};

const applyAuthenticatedSettings = async (): Promise<void> => {
  try {
    const settings = await settingsApi.get();
    const locale = (settings.language === 'de' ? 'de' : 'en') as LocaleCode;
    setLocale(locale);
    dayjs.locale(locale);
    applyUserThemePreferences({
      autoTheme: settings.autoTheme,
      darkTheme: settings.darkTheme,
      lightTheme: settings.lightTheme,
    });
  } catch {
    applyGuestLocale();
  }
};

// -------------------------------------------------- Lifecycle --------------------------------------------------
onMounted(async () => {
  migrateLegacyThemeLocalStorage();
  await fetchNeedsSetup();
  const token = authStore.token;
  if (token) {
    await authStore.validate();
  }
  if (authStore.validated) {
    await applyAuthenticatedSettings();
  } else {
    applyGuestLocale();
  }
  bBooting.value = false;
});

watch(
  () => authStore.validated,
  async (ok, was) => {
    if (bBooting.value) {
      return;
    }
    if (ok && was === false) {
      await applyAuthenticatedSettings();
    }
    if (!ok && was === true) {
      applyGuestLocale();
    }
  },
);

watch(bBooting, async (boot) => {
  if (!boot) {
    await nextTick();
    fadeInElement(appRoot.value);
  }
});
</script>

<template>
  <div v-if="bBooting" class="flex h-dvh items-center justify-center bg-bg text-text-muted">
    {{ t('common.loading') }}
  </div>
  <div v-else ref="appRoot" class="min-h-dvh">
    <RouterView />
  </div>
</template>
