// node_modules
import dayjs from 'dayjs';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

// classes
import { type TaskListParams, taskApi } from '@/classes/api';

// lib
import { isDueToday, isDueSoon, isOverdue } from '@/lib/utils';

// types
import type { Task } from '@/@types/index';

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([]);

  const tasksByListId = computed(() => {
    const map: Record<string, Task[]> = {};
    for (const task of tasks.value) {
      if (!map[task.listId]) {
        map[task.listId] = [];
      }
      map[task.listId]!.push(task);
    }
    return map;
  });

  function topLevelTasks(listId: string): Task[] {
    return tasks.value.filter((task) => task.listId === listId && !task.parentTaskId);
  }

  function subTasksOf(taskId: string): Task[] {
    return tasks.value.filter((task) => task.parentTaskId === taskId);
  }

  function doneTasks(listId: string): Task[] {
    return topLevelTasks(listId).filter((task) => task.done);
  }

  function activeTasks(listId: string): Task[] {
    return topLevelTasks(listId).filter((task) => !task.done);
  }

  const overdueTasks = computed(() => {
    return tasks.value.filter(
      (task) => !task.parentTaskId && isOverdue(task.dueDate, task.done),
    );
  });

  const upcomingTasks = computed(() => {
    const end = dayjs().add(7, 'day');
    return tasks.value.filter((task) => {
      if (task.parentTaskId || task.done || !task.dueDate) {
        return false;
      }
      const d = dayjs(task.dueDate);
      return d.isBefore(end) || d.isSame(end, 'day');
    });
  });

  async function fetchTasks(params?: TaskListParams): Promise<void> {
    tasks.value = await taskApi.list(params);
  }

  async function fetchTask(id: string): Promise<Task> {
    return taskApi.get(id);
  }

  async function createTask(payload: Record<string, unknown>): Promise<Task> {
    const created = await taskApi.create(payload);
    await fetchTasks();
    return created;
  }

  async function updateTask(id: string, payload: Record<string, unknown>): Promise<Task> {
    const updated = await taskApi.update(id, payload);
    await fetchTasks();
    return updated;
  }

  async function deleteTask(id: string): Promise<void> {
    await taskApi.delete(id);
    await fetchTasks();
  }

  async function toggleDone(id: string): Promise<void> {
    await taskApi.toggleDone(id);
    await fetchTasks();
  }

  async function reorderTasks(items: { id: string; sortOrder: number }[]): Promise<void> {
    await taskApi.reorder(items);
    await fetchTasks();
  }

  async function clearCompleted(listId: string): Promise<void> {
    await taskApi.clearCompleted(listId);
    await fetchTasks();
  }

  function dueTodayTasks(): Task[] {
    return tasks.value.filter(
      (task) => !task.parentTaskId && !task.done && isDueToday(task.dueDate),
    );
  }

  function dueThisWeekTasks(): Task[] {
    return tasks.value.filter((task) => {
      if (task.parentTaskId || task.done || !task.dueDate) {
        return false;
      }
      if (isOverdue(task.dueDate, false) || isDueToday(task.dueDate)) {
        return false;
      }
      return isDueSoon(task.dueDate, 7);
    });
  }

  return {
    tasks,
    tasksByListId,
    topLevelTasks,
    subTasksOf,
    doneTasks,
    activeTasks,
    overdueTasks,
    upcomingTasks,
    fetchTasks,
    fetchTask,
    createTask,
    updateTask,
    deleteTask,
    toggleDone,
    reorderTasks,
    clearCompleted,
    dueTodayTasks,
    dueThisWeekTasks,
  };
});
