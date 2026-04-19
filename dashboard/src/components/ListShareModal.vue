<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { collaborationApi } from '@/classes/api';
import type { List, ListShare } from '@/@types/index';
import GsapModal from './shared/GsapModal.vue';

const props = defineProps<{
  show: boolean;
  list: List;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const shares = ref<(ListShare & { user: { id: string; username: string } })[]>([]);
const loading = ref(false);
const _error = ref<string | null>(null);
const error = _error;
const newUsername = ref('');
const newPermission = ref<'READ' | 'WRITE' | 'ADMIN'>('READ');
const isSubmitting = ref(false);

const canManage = computed(() => !(props.list as List & { isShared?: boolean }).isShared);

async function loadShares() {
  loading.value = true;
  error.value = null;
  try {
    shares.value = await collaborationApi.listShares(props.list.id);
  } catch {
    _error.value = 'Failed to load shares';
  } finally {
    loading.value = false;
  }
}

async function addShare() {
  if (!newUsername.value.trim()) return;
  isSubmitting.value = true;
  error.value = null;
  try {
    const share = await collaborationApi.shareList(props.list.id, {
      username: newUsername.value.trim(),
      permission: newPermission.value,
    });
    shares.value.push(share);
    newUsername.value = '';
    newPermission.value = 'READ';
  } catch (e: unknown) {
    const message =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Failed to add share';
    _error.value = message || 'Failed to add share';
  } finally {
    isSubmitting.value = false;
  }
}

async function updatePermission(userId: string, permission: 'READ' | 'WRITE' | 'ADMIN') {
  try {
    const updated = await collaborationApi.updateShare(props.list.id, userId, { permission });
    const index = shares.value.findIndex((s) => s.userId === userId);
    if (index !== -1) {
      shares.value[index] = updated;
    }
  } catch {
    _error.value = 'Failed to update permission';
  }
}

async function removeShare(userId: string) {
  try {
    await collaborationApi.removeShare(props.list.id, userId);
    shares.value = shares.value.filter((s) => s.userId !== userId);
  } catch {
    _error.value = 'Failed to remove share';
  }
}

function close() {
  emit('close');
}

// Reload shares whenever modal is opened
watch(
  () => props.show,
  (show) => {
    if (show) {
      newUsername.value = '';
      newPermission.value = 'READ';
      error.value = null;
      loadShares();
    }
  },
);
</script>

<template>
  <GsapModal :show="show">
    <div class="modal-backdrop" @click="close" />
    <div class="modal-panel share-modal">
      <div class="modal-header gap-3">
        <h2 class="min-w-0 flex-1 text-lg font-semibold break-words">
          Share "{{ list.title }}"
        </h2>
        <button type="button" class="close-button shrink-0" @click="close">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="modal-body space-y-5">
        <div v-if="canManage" class="add-share-section">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">
            Invite User
          </h3>
          <div
            class="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
          >
            <input
              v-model="newUsername"
              type="text"
              placeholder="Enter username"
              class="min-w-0 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              @keyup.enter="addShare"
            />
            <select
              v-model="newPermission"
              class="!h-auto !max-h-none !min-h-0 w-full min-w-0 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none sm:w-auto"
            >
              <option value="READ">Can view</option>
              <option value="WRITE">Can edit</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button
              type="button"
              class="w-full shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              :disabled="!newUsername.trim() || isSubmitting"
              @click="addShare"
            >
              <span v-if="isSubmitting">...</span>
              <span v-else>Invite</span>
            </button>
          </div>
          <p v-if="_error" class="text-destructive text-sm mt-2">{{ _error }}</p>
        </div>

        <div class="shares-list">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">
            Shared With ({{ shares.length }})
          </h3>
          <p v-if="error && !loading" class="text-destructive text-sm mb-3">{{ error }}</p>
          <div v-if="loading" class="flex items-center justify-center py-6 text-text-muted">
            <svg class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading...
          </div>
          <div
            v-else-if="shares.length === 0"
            class="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-6 text-center"
          >
            <p class="text-sm text-text-muted">Not shared with anyone yet</p>
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="share in shares"
              :key="share.id"
              class="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
            >
              <div class="flex min-w-0 items-center gap-2">
                <div
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                >
                  {{ share.user.username.charAt(0).toUpperCase() }}
                </div>
                <span class="min-w-0 truncate text-sm font-medium text-text-primary">{{
                  share.user.username
                }}</span>
              </div>
              <div class="flex shrink-0 items-center justify-end gap-2 sm:justify-start">
                <select
                  v-if="canManage"
                  v-model="share.permission"
                  class="!h-auto !max-h-none !min-h-0 w-auto shrink-0 rounded border border-border bg-bg px-2 py-1 text-xs text-text-primary focus:border-primary focus:outline-none"
                  @change="updatePermission(share.userId, share.permission)"
                >
                  <option value="READ">Can view</option>
                  <option value="WRITE">Can edit</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <span v-else class="text-xs text-text-muted">{{ share.permission }}</span>
                <button
                  v-if="canManage"
                  class="rounded p-1 text-text-muted hover:bg-destructive/10 hover:text-destructive transition-colors"
                  title="Remove access"
                  @click="removeShare(share.userId)"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </GsapModal>
</template>

<style scoped>
.share-modal {
  width: 100%;
  max-width: 480px;
  min-width: 0;
}
</style>
