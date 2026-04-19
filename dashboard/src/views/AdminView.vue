<script setup lang="ts">
// node_modules
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

// classes
import { adminApi } from '@/classes/api';

// components
import ConfirmModal from '@/components/shared/ConfirmModal.vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import PageShell from '@/components/layout/PageShell.vue';

// stores
import { useAuthStore } from '@/stores/auth';

// types
import type { User } from '@/@types/index';

// -------------------------------------------------- Store --------------------------------------------------
const authStore = useAuthStore();
const { t } = useI18n();

// -------------------------------------------------- Data --------------------------------------------------
const tab = ref<'users' | 'settings'>('users');
const users = ref<User[]>([]);
const bRegistration = ref(true);
const bCommentsEnabled = ref(true);
const aiApiUrl = ref('');
const aiApiKey = ref('');
const aiApiKeyPlaceholder = ref('');
const aiModel = ref('');
const bAiSaving = ref(false);
const bAiSaved = ref(false);
const bAiTesting = ref(false);
const aiTestResult = ref<{ ok: boolean; error?: string } | null>(null);
const bLoading = ref(false);
const deleteTarget = ref<User | null>(null);

// -------------------------------------------------- Lifecycle --------------------------------------------------
onMounted(async () => {
  await refresh();
});

// -------------------------------------------------- Methods --------------------------------------------------
const refresh = async (): Promise<void> => {
  bLoading.value = true;
  try {
    users.value = await adminApi.listUsers();
    const settings = await adminApi.getSettings();
    bRegistration.value = settings.registrationEnabled;
    bCommentsEnabled.value = settings.commentsEnabled;
    aiApiUrl.value = settings.aiApiUrl ?? '';
    aiModel.value = settings.aiModel ?? '';
    // The server returns '••••••••' when a key is set, or null when not set
    aiApiKeyPlaceholder.value = settings.aiApiKey ?? '';
    aiApiKey.value = '';
  } finally {
    bLoading.value = false;
  }
};

const isSelf = (user: User): boolean => {
  if (authStore.userId) {
    return user.id === authStore.userId;
  }
  return user.username === authStore.username;
};

const toggleAdmin = async (user: User): Promise<void> => {
  if (isSelf(user)) {
    return;
  }
  await adminApi.updateUser(user.id, { isAdmin: !user.isAdmin });
  await refresh();
};

const confirmDelete = async (): Promise<void> => {
  if (!deleteTarget.value) {
    return;
  }
  await adminApi.deleteUser(deleteTarget.value.id);
  deleteTarget.value = null;
  await refresh();
};

const setRegistrationEnabled = async (enabled: boolean): Promise<void> => {
  bRegistration.value = enabled;
  await adminApi.updateSettings({ registrationEnabled: enabled });
};

const setCommentsEnabled = async (enabled: boolean): Promise<void> => {
  bCommentsEnabled.value = enabled;
  await adminApi.updateSettings({ commentsEnabled: enabled });
};

const testAiSettings = async (): Promise<void> => {
  bAiTesting.value = true;
  aiTestResult.value = null;
  try {
    const result = await adminApi.testAi({
      aiApiUrl: aiApiUrl.value.trim() || null,
      // Only send the key if the user typed a new one; otherwise the backend uses the saved one
      aiApiKey: aiApiKey.value.trim() || null,
      aiModel: aiModel.value.trim() || null,
    });
    aiTestResult.value = result;
  } catch (err) {
    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      ?? (err instanceof Error ? err.message : String(err));
    aiTestResult.value = { ok: false, error: msg };
  } finally {
    bAiTesting.value = false;
  }
};

const saveAiSettings = async (): Promise<void> => {
  bAiSaving.value = true;
  bAiSaved.value = false;
  try {
    const payload: { aiApiUrl?: string | null; aiApiKey?: string | null; aiModel?: string | null } = {
      aiApiUrl: aiApiUrl.value.trim() || null,
      aiModel: aiModel.value.trim() || null,
    };
    // Only send the key if the user actually typed something new
    if (aiApiKey.value.trim()) {
      payload.aiApiKey = aiApiKey.value.trim();
    }
    await adminApi.updateSettings(payload);
    aiApiKey.value = '';
    await refresh();
    bAiSaved.value = true;
    setTimeout(() => { bAiSaved.value = false; }, 3000);
  } finally {
    bAiSaving.value = false;
  }
};
</script>

<template>
  <PageShell>
    <PageHeader :title="t('admin.title')" />
    <nav class="tab-navigation mb-6">
      <button type="button" :class="{ 'is-active': tab === 'users' }" @click="tab = 'users'">
        {{ t('admin.users') }}
      </button>
      <button type="button" :class="{ 'is-active': tab === 'settings' }" @click="tab = 'settings'">
        {{ t('admin.settings') }}
      </button>
    </nav>
    <div v-if="tab === 'users'" class="overflow-x-auto rounded-md border border-border">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-border bg-card/40 text-text-muted">
          <tr>
            <th class="px-4 py-2">{{ t('auth.username') }}</th>
            <th class="px-4 py-2">{{ t('admin.isAdmin') }}</th>
            <th class="px-4 py-2">{{ t('admin.createdAt') }}</th>
            <th class="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id" class="border-b border-border/60">
            <td class="px-4 py-2">{{ user.username }}</td>
            <td class="px-4 py-2">{{ user.isAdmin ? '✓' : '—' }}</td>
            <td class="px-4 py-2 text-text-muted">{{ new Date(user.createdAt).toLocaleString() }}</td>
            <td class="px-4 py-2 text-end">
              <button
                type="button"
                class="button is-transparent text-xs disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="isSelf(user)"
                :title="isSelf(user) ? t('admin.cannotSelf') : undefined"
                @click="toggleAdmin(user)"
              >
                {{ t('admin.toggleAdmin') }}
              </button>
              <button
                type="button"
                class="button is-destructive text-xs disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="isSelf(user)"
                :title="isSelf(user) ? t('admin.cannotSelf') : undefined"
                @click="deleteTarget = user"
              >
                {{ t('admin.deleteUser') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="bLoading" class="p-4 text-text-muted">{{ t('common.loading') }}</p>
    </div>
    <div v-else class="space-y-4">
      <div class="field">
        <label class="label">{{ t('admin.registration') }}</label>
        <div
          class="inline-flex w-max max-w-full flex-wrap items-stretch gap-0.5 rounded-md border border-border p-0.5"
        >
          <button
            type="button"
            class="button !h-9 !max-h-9 !min-h-9 shrink-0 border-0 px-4 py-0 text-sm"
            :class="bRegistration ? 'is-primary' : 'is-transparent'"
            @click="setRegistrationEnabled(true)"
          >
            {{ t('admin.registrationOn') }}
          </button>
          <button
            type="button"
            class="button !h-9 !max-h-9 !min-h-9 shrink-0 border-0 px-4 py-0 text-sm"
            :class="!bRegistration ? 'is-primary' : 'is-transparent'"
            @click="setRegistrationEnabled(false)"
          >
            {{ t('admin.registrationOff') }}
          </button>
        </div>
      </div>
      <div class="field">
        <label class="label">{{ t('admin.comments') }}</label>
        <div
          class="inline-flex w-max max-w-full flex-wrap items-stretch gap-0.5 rounded-md border border-border p-0.5"
        >
          <button
            type="button"
            class="button !h-9 !max-h-9 !min-h-9 shrink-0 border-0 px-4 py-0 text-sm"
            :class="bCommentsEnabled ? 'is-primary' : 'is-transparent'"
            @click="setCommentsEnabled(true)"
          >
            {{ t('admin.commentsOn') }}
          </button>
          <button
            type="button"
            class="button !h-9 !max-h-9 !min-h-9 shrink-0 border-0 px-4 py-0 text-sm"
            :class="!bCommentsEnabled ? 'is-primary' : 'is-transparent'"
            @click="setCommentsEnabled(false)"
          >
            {{ t('admin.commentsOff') }}
          </button>
        </div>
      </div>

      <!-- AI Settings -->
      <div class="field">
        <label class="label">{{ t('admin.aiSettings') }}</label>
        <div class="space-y-2 rounded-xl border border-border p-4">
          <div>
            <label class="mb-1 block text-xs text-text-muted">{{ t('admin.aiApiUrl') }}</label>
            <input
              v-model="aiApiUrl"
              type="url"
              :placeholder="t('admin.aiApiUrlPlaceholder')"
              class="!rounded-lg text-sm"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs text-text-muted">{{ t('admin.aiApiKey') }}</label>
            <input
              v-model="aiApiKey"
              type="password"
              autocomplete="new-password"
              :placeholder="aiApiKeyPlaceholder || t('admin.aiApiKeyPlaceholder')"
              class="!rounded-lg text-sm"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs text-text-muted">{{ t('admin.aiModel') }}</label>
            <input
              v-model="aiModel"
              type="text"
              :placeholder="t('admin.aiModelPlaceholder')"
              class="!rounded-lg text-sm"
            />
          </div>
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              class="button is-primary !rounded-lg text-sm"
              :disabled="bAiSaving"
              @click="saveAiSettings"
            >
              {{ bAiSaving ? t('common.loading') : t('common.save') }}
            </button>
            <button
              type="button"
              class="button !rounded-lg text-sm"
              :disabled="bAiTesting || bAiSaving"
              @click="testAiSettings"
            >
              <span v-if="bAiTesting" class="loading-spinner" />
              {{ bAiTesting ? t('admin.aiTesting') : t('admin.aiTest') }}
            </button>
            <span v-if="bAiSaved" class="text-xs text-green-500">{{ t('admin.aiSaved') }}</span>
          </div>
          <!-- Test result -->
          <div v-if="aiTestResult !== null" class="mt-2 rounded-lg px-3 py-2 text-sm"
            :class="aiTestResult.ok
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-destructive/10 text-destructive'"
          >
            <span v-if="aiTestResult.ok">{{ t('admin.aiTestOk') }}</span>
            <span v-else>{{ t('admin.aiTestFail') }}: {{ aiTestResult.error }}</span>
          </div>
        </div>
      </div>
    </div>
    <ConfirmModal
      :is-open="!!deleteTarget"
      :title="t('admin.deleteUser')"
      :message="
        deleteTarget
          ? t('admin.confirmDeleteUser', { name: deleteTarget.username })
          : ''
      "
      destructive
      :confirm-label="t('common.delete')"
      @close="deleteTarget = null"
      @confirm="confirmDelete"
    />
  </PageShell>
</template>
