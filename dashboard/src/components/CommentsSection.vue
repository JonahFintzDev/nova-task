<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { collaborationApi } from '@/classes/api';
import { useAuthStore } from '@/stores/auth';
import type { Comment, Task } from '@/@types/index';

const props = defineProps<{
  task: Task;
  canEdit?: boolean;
}>();

const authStore = useAuthStore();
const currentUserId = computed(() => authStore.userId);

const comments = ref<(Comment & { user: { id: string; username: string } })[]>([]);
const loading = ref(false);
const errorMessage = ref('');
const newComment = ref('');
const editingComment = ref<string | null>(null);
const editContent = ref('');
const isSubmitting = ref(false);

const sortedComments = computed(() => {
  return [...comments.value].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
});

async function loadComments() {
  loading.value = true;
  errorMessage.value = '';
  try {
    comments.value = await collaborationApi.listComments(props.task.id);
  } catch (error: unknown) {
    const message =
      error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
    errorMessage.value = message || 'Failed to load comments';
    comments.value = [];
  } finally {
    loading.value = false;
  }
}

async function addComment() {
  if (!newComment.value.trim() || isSubmitting.value) return;
  isSubmitting.value = true;
  errorMessage.value = '';
  try {
    const comment = await collaborationApi.createComment(props.task.id, newComment.value.trim());
    comments.value.push(comment);
    newComment.value = '';
  } catch (error: unknown) {
    const message =
      error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
    errorMessage.value = message || 'Failed to add comment';
  } finally {
    isSubmitting.value = false;
  }
}

function startEdit(comment: Comment & { user: { id: string; username: string } }) {
  editingComment.value = comment.id;
  editContent.value = comment.content;
}

async function saveEdit(commentId: string) {
  if (!editContent.value.trim()) return;
  try {
    const updated = await collaborationApi.updateComment(commentId, editContent.value.trim());
    const index = comments.value.findIndex((c) => c.id === commentId);
    if (index !== -1) {
      comments.value[index] = updated;
    }
    editingComment.value = null;
    editContent.value = '';
  } catch (error: unknown) {
    const message =
      error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
    errorMessage.value = message || 'Failed to update comment';
  }
}

function cancelEdit() {
  editingComment.value = null;
  editContent.value = '';
}

async function deleteComment(commentId: string) {
  if (!confirm('Delete this comment?')) return;
  try {
    await collaborationApi.deleteComment(commentId);
    comments.value = comments.value.filter((c) => c.id !== commentId);
  } catch (error: unknown) {
    const message =
      error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
    errorMessage.value = message || 'Failed to delete comment';
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}

onMounted(() => {
  loadComments();
});
</script>

<template>
  <div class="comments-section">
    <!-- Header -->
    <div class="flex items-center gap-2 mb-5">
      <svg class="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
      <h3 class="text-base font-semibold text-text-primary">
        Comments
        <span v-if="comments.length > 0" class="ml-1.5 text-sm font-medium text-text-muted">
          {{ comments.length }}
        </span>
      </h3>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-8 text-text-muted">
      <svg class="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      Loading comments...
    </div>
    <p v-if="errorMessage" class="mb-3 text-sm text-destructive">
      {{ errorMessage }}
    </p>

    <!-- Comments List -->
    <div v-else class="space-y-3 mb-6">
      <div
        v-for="comment in sortedComments"
        :key="comment.id"
        class="group rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-sm"
      >
        <!-- Edit Mode -->
        <div v-if="editingComment === comment.id" class="space-y-3">
          <textarea
            v-model="editContent"
            rows="3"
            class="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div class="flex items-center gap-2">
            <button
              class="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              @click="saveEdit(comment.id)"
            >
              Save
            </button>
            <button
              class="rounded-lg px-3 py-1.5 text-sm font-medium text-text-muted hover:bg-fg/5 hover:text-text-primary transition-colors"
              @click="cancelEdit"
            >
              Cancel
            </button>
          </div>
        </div>

        <!-- View Mode -->
        <div v-else>
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2">
              <div
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
              >
                {{ comment.user.username.charAt(0).toUpperCase() }}
              </div>
              <span class="text-sm font-medium text-text-primary">{{ comment.user.username }}</span>
              <span class="text-xs text-text-muted">· {{ formatDate(comment.createdAt) }}</span>
            </div>

            <!-- Actions -->
            <div
              v-if="canEdit && comment.userId === currentUserId"
              class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <button
                class="rounded p-1 text-text-muted hover:bg-fg/5 hover:text-text-primary transition-colors"
                title="Edit"
                @click="startEdit(comment)"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                class="rounded p-1 text-text-muted hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Delete"
                @click="deleteComment(comment.id)"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>

          <p class="mt-2 text-sm leading-relaxed text-text-primary whitespace-pre-wrap">
            {{ comment.content }}
          </p>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-if="comments.length === 0"
        class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-8 text-center"
      >
        <svg
          class="mb-2 h-10 w-10 text-text-muted/50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <p class="text-sm text-text-muted">No comments yet</p>
        <p class="mt-1 text-xs text-text-muted/70">Be the first to share your thoughts</p>
      </div>
    </div>

    <!-- Add Comment -->
    <div v-if="canEdit" class="rounded-xl border border-border bg-surface p-4">
      <div class="flex items-start gap-3">
        <div
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
        >
          {{ authStore.username?.charAt(0).toUpperCase() || '?' }}
        </div>
        <div class="flex-1 min-w-0">
          <textarea
            v-model="newComment"
            rows="2"
            placeholder="Write a comment..."
            class="w-full resize-none rounded-lg border-0 bg-transparent px-0 py-0.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-0"
            @keyup.ctrl.enter="addComment"
          />
          <div class="mt-3 flex items-center justify-between">
            <span class="text-xs text-text-muted">Ctrl + Enter to post</span>
            <button
              class="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              :disabled="!newComment.trim() || isSubmitting"
              @click="addComment"
            >
              <span v-if="isSubmitting" class="flex items-center gap-1.5">
                <svg class="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
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
                Posting...
              </span>
              <span v-else>Post</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
