<script setup lang="ts">
import { ref, computed } from 'vue';
import { collaborationApi } from '@/classes/api';
import type { Task } from '@/@types/index';

const props = defineProps<{
  task: Task;
  canAssign?: boolean;
}>();

const emit = defineEmits<{
  (e: 'assigned', task: Task): void;
  (e: 'unassigned', task: Task): void;
}>();

const isAssigning = ref(false);
const username = ref('');
const isSubmitting = ref(false);

const hasAssignee = computed(() => !!props.task.assignedTo);
const assigneeName = computed(() => props.task.assignedTo?.username ?? '');

function startAssign() {
  if (!props.canAssign) return;
  isAssigning.value = true;
  username.value = '';
}

function cancelAssign() {
  isAssigning.value = false;
  username.value = '';
}

async function assign() {
  if (!username.value.trim() || isSubmitting.value) return;
  isSubmitting.value = true;
  try {
    const updated = await collaborationApi.assignTask(props.task.id, username.value.trim());
    emit('assigned', updated);
    isAssigning.value = false;
    username.value = '';
  } catch (e: unknown) {
    const message =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to assign'
        : 'Failed to assign';
    alert(message);
  } finally {
    isSubmitting.value = false;
  }
}

async function unassign() {
  if (!confirm('Unassign this task?')) return;
  try {
    const updated = await collaborationApi.unassignTask(props.task.id);
    emit('unassigned', updated);
  } catch {
    alert('Failed to unassign');
  }
}
</script>

<template>
  <div class="task-assign flex items-center gap-2">
    <span class="text-sm font-medium text-gray-600">Assigned to:</span>

    <div v-if="hasAssignee" class="flex items-center gap-2">
      <span class="px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
        {{ assigneeName }}
      </span>
      <button
        v-if="canAssign"
        class="text-sm text-red-600 hover:text-red-800"
        @click="unassign"
      >
        Remove
      </button>
    </div>

    <div v-else-if="canAssign">
      <div v-if="isAssigning" class="flex items-center gap-2">
        <input
          v-model="username"
          type="text"
          placeholder="Username"
          class="px-2 py-1 border rounded text-sm"
          @keyup.enter="assign"
        />
        <button
          class="text-sm text-primary-600 hover:text-primary-800"
          :disabled="!username.trim() || isSubmitting"
          @click="assign"
        >
          Assign
        </button>
        <button class="text-sm text-gray-500 hover:text-gray-700" @click="cancelAssign">Cancel</button>
      </div>
      <button v-else class="text-sm text-primary-600 hover:text-primary-800" @click="startAssign">
        + Assign
      </button>
    </div>

    <span v-else class="text-sm text-gray-400">Unassigned</span>
  </div>
</template>
