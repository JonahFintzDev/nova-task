<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { collaborationApi } from '@/classes/api';
import type { ListShare, List, User } from '@/@types/index';

const shares = ref<
  (ListShare & { list: List & { user: Pick<User, 'id' | 'username'>; taskCount: number } })[]
>([]);
const loading = ref(false);

async function loadSharedLists() {
  loading.value = true;
  try {
    shares.value = await collaborationApi.listShared();
  } finally {
    loading.value = false;
  }
}

function getPermissionColor(permission: string): string {
  switch (permission) {
    case 'ADMIN':
      return 'bg-purple-100 text-purple-700';
    case 'WRITE':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

onMounted(() => {
  loadSharedLists();
});
</script>

<template>
  <div class="shared-lists">
    <h2 class="text-xl font-bold mb-4">Shared with Me</h2>

    <div v-if="loading" class="text-center py-8">Loading...</div>

    <div v-else-if="shares.length === 0" class="text-gray-500 text-center py-8">
      No lists have been shared with you yet
    </div>

    <div v-else class="grid gap-4">
      <div
        v-for="share in shares"
        :key="share.id"
        class="p-4 bg-surface rounded-lg border border-gray-200 hover:border-primary transition-colors cursor-pointer"
        @click="$router.push(`/list/${share.listId}`)"
      >
        <div class="flex items-start justify-between mb-2">
          <h3 class="font-semibold text-lg">{{ share.list.title }}</h3>
          <span
            class="px-2 py-1 rounded-full text-xs font-medium"
            :class="getPermissionColor(share.permission)"
          >
            {{ share.permission }}
          </span>
        </div>

        <p class="text-sm text-gray-600 mb-2">
          Shared by: <span class="font-medium">{{ share.list.user.username }}</span>
        </p>

        <div class="flex items-center gap-4 text-sm text-gray-500">
          <span>{{ share.list.taskCount }} tasks</span>
          <span v-if="share.list.icon" class="text-xl">{{ share.list.icon }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
