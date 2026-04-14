<script setup lang="ts">
// node_modules
import dayjs from 'dayjs';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

// classes
import { settingsApi } from '@/classes/api';

// lib
import {
  applyUserThemePreferences,
  deriveAppearanceChoice,
  settingsPatchForAppearance,
  type AppearanceChoice,
} from '@/lib/themes';
import { setLocale, type LocaleCode } from '@/lib/i18n';

// components
import PageHeader from '@/components/layout/PageHeader.vue';
import PageShell from '@/components/layout/PageShell.vue';

// -------------------------------------------------- Data --------------------------------------------------

const { t, locale } = useI18n();
const tab = ref<'appearance' | 'language' | 'security'>('appearance');
const appearance = ref<AppearanceChoice>('auto');
const language = ref<LocaleCode>('en');
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const bSaving = ref(false);
const message = ref('');

// -------------------------------------------------- Lifecycle --------------------------------------------------

onMounted(async () => {
  const settings = await settingsApi.get();
  appearance.value = deriveAppearanceChoice({
    autoTheme: settings.autoTheme,
    darkTheme: settings.darkTheme,
    lightTheme: settings.lightTheme,
  });
  language.value = settings.language === 'de' ? 'de' : 'en';
  locale.value = language.value;
  dayjs.locale(language.value);
  applyUserThemePreferences({
    autoTheme: settings.autoTheme,
    darkTheme: settings.darkTheme,
    lightTheme: settings.lightTheme,
  });
});

// -------------------------------------------------- Methods --------------------------------------------------

async function persistAppearance(choice: AppearanceChoice): Promise<void> {
  appearance.value = choice;
  const patch = settingsPatchForAppearance(choice);
  await settingsApi.update(patch);
  applyUserThemePreferences(patch);
}

async function onLanguageChange(code: LocaleCode): Promise<void> {
  language.value = code;
  setLocale(code);
  locale.value = code;
  dayjs.locale(code);
  await settingsApi.update({ language: code });
}

async function changePassword(): Promise<void> {
  message.value = '';
  if (newPassword.value !== confirmPassword.value) {
    message.value = t('settings.passwordMismatch');
    return;
  }
  bSaving.value = true;
  try {
    const { authApi } = await import('@/classes/api');
    await authApi.changePassword(currentPassword.value, newPassword.value);
    message.value = t('settings.passwordSuccess');
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
  } catch {
    message.value = t('common.error');
  } finally {
    bSaving.value = false;
  }
}
</script>

<template>
  <PageShell narrow>
    <PageHeader :title="t('settings.title')" />
    <nav class="tab-navigation mb-6">
      <button
        type="button"
        :class="{ 'is-active': tab === 'appearance' }"
        @click="tab = 'appearance'"
      >
        {{ t('settings.appearance') }}
      </button>
      <button type="button" :class="{ 'is-active': tab === 'language' }" @click="tab = 'language'">
        {{ t('settings.language') }}
      </button>
      <button type="button" :class="{ 'is-active': tab === 'security' }" @click="tab = 'security'">
        {{ t('settings.security') }}
      </button>
    </nav>
    <div v-if="tab === 'appearance'" class="space-y-4">
      <div class="field">
        <label class="label">{{ t('settings.theme') }}</label>
        <div
          class="inline-flex w-max max-w-full flex-wrap items-stretch gap-0.5 rounded-md border border-border p-0.5"
        >
          <button
            type="button"
            class="button !h-9 !max-h-9 !min-h-9 shrink-0 border-0 px-4 py-0 text-sm"
            :class="appearance === 'auto' ? 'is-primary' : 'is-transparent'"
            @click="persistAppearance('auto')"
          >
            {{ t('settings.themeAuto') }}
          </button>
          <button
            type="button"
            class="button !h-9 !max-h-9 !min-h-9 shrink-0 border-0 px-4 py-0 text-sm"
            :class="appearance === 'light' ? 'is-primary' : 'is-transparent'"
            @click="persistAppearance('light')"
          >
            {{ t('settings.themeLight') }}
          </button>
          <button
            type="button"
            class="button !h-9 !max-h-9 !min-h-9 shrink-0 border-0 px-4 py-0 text-sm"
            :class="appearance === 'dark' ? 'is-primary' : 'is-transparent'"
            @click="persistAppearance('dark')"
          >
            {{ t('settings.themeDark') }}
          </button>
        </div>
      </div>
    </div>
    <div v-else-if="tab === 'language'" class="space-y-4">
      <div class="field">
        <label class="label">{{ t('settings.displayLanguage') }}</label>
        <div
          class="inline-flex w-max max-w-full flex-wrap items-stretch gap-0.5 rounded-md border border-border p-0.5"
        >
          <button
            type="button"
            class="button !h-9 !max-h-9 !min-h-9 shrink-0 border-0 px-4 py-0 text-sm"
            :class="language === 'en' ? 'is-primary' : 'is-transparent'"
            @click="onLanguageChange('en')"
          >
            {{ t('settings.languageEn') }}
          </button>
          <button
            type="button"
            class="button !h-9 !max-h-9 !min-h-9 shrink-0 border-0 px-4 py-0 text-sm"
            :class="language === 'de' ? 'is-primary' : 'is-transparent'"
            @click="onLanguageChange('de')"
          >
            {{ t('settings.languageDe') }}
          </button>
        </div>
      </div>
    </div>
    <div v-else class="space-y-4">
      <div class="field">
        <label class="label">{{ t('settings.currentPassword') }}</label>
        <input v-model="currentPassword" type="password" autocomplete="current-password" />
      </div>
      <div class="field">
        <label class="label">{{ t('settings.newPassword') }}</label>
        <input v-model="newPassword" type="password" autocomplete="new-password" />
      </div>
      <div class="field">
        <label class="label">{{ t('settings.confirmPassword') }}</label>
        <input v-model="confirmPassword" type="password" autocomplete="new-password" />
      </div>
      <p v-if="message" class="message" :class="message.includes('success') ? 'is-success' : 'is-error'">
        {{ message }}
      </p>
      <button type="button" class="button is-primary" :disabled="bSaving" @click="changePassword">
        {{ t('settings.savePassword') }}
      </button>
    </div>
  </PageShell>
</template>
