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
const bLoading = ref(false);
const deleteTarget = ref<User | null>(null);

// -------------------------------------------------- Lifecycle --------------------------------------------------

onMounted(async () => {
  await refresh();
});

// -------------------------------------------------- Methods --------------------------------------------------

async function refresh(): Promise<void> {
  bLoading.value = true;
  try {
    users.value = await adminApi.listUsers();
    const settings = await adminApi.getSettings();
    bRegistration.value = settings.registrationEnabled;
  } finally {
    bLoading.value = false;
  }
}

function isSelf(user: User): boolean {
  if (authStore.userId) {
    return user.id === authStore.userId;
  }
  return user.username === authStore.username;
}

async function toggleAdmin(user: User): Promise<void> {
  if (isSelf(user)) {
    return;
  }
  await adminApi.updateUser(user.id, { isAdmin: !user.isAdmin });
  await refresh();
}

async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) {
    return;
  }
  await adminApi.deleteUser(deleteTarget.value.id);
  deleteTarget.value = null;
  await refresh();
}

async function setRegistrationEnabled(enabled: boolean): Promise<void> {
  bRegistration.value = enabled;
  await adminApi.updateSettings({ registrationEnabled: enabled });
}
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
