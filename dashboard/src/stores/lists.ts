// node_modules
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

// classes
import { listApi } from '@/classes/api';

// lib
import { getListsSnapshot, setListsSnapshot } from '@/lib/pwa-offline-db';

// types
import type { List } from '@/@types/index';

export const useListsStore = defineStore('lists', () => {
  const lists = ref<List[]>([]);

  const listsByCategory = computed(() => {
    const map = new Map<string, List[]>();
    for (const list of lists.value) {
      const key = list.category?.trim() || '';
      const label = key || '__uncat__';
      if (!map.has(label)) {
        map.set(label, []);
      }
      map.get(label)!.push(list);
    }
    return map;
  });

  function listById(id: string): List | undefined {
    return lists.value.find((list) => list.id === id);
  }

  async function fetchLists(): Promise<void> {
    try {
      lists.value = await listApi.list();
      await setListsSnapshot(lists.value);
    } catch {
      const cached = await getListsSnapshot();
      if (cached?.length) {
        lists.value = cached;
      }
      // Keep existing in-memory lists when network and cache both fail.
    }
  }

  async function createList(payload: Partial<List> & { title: string }): Promise<List> {
    const created = await listApi.create(payload);
    await fetchLists();
    return created;
  }

  async function updateList(id: string, payload: Partial<List>): Promise<void> {
    await listApi.update(id, payload);
    await fetchLists();
  }

  async function deleteList(id: string): Promise<void> {
    await listApi.delete(id);
    await fetchLists();
  }

  async function reorderLists(items: { id: string; sortOrder: number }[]): Promise<void> {
    await listApi.reorder(items);
    await fetchLists();
  }

  return {
    lists,
    listsByCategory,
    listById,
    fetchLists,
    createList,
    updateList,
    deleteList,
    reorderLists,
  };
});
