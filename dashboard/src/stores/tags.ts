// node_modules
import { defineStore } from 'pinia';
import { ref } from 'vue';

// classes
import { tagApi } from '@/classes/api';

// types
import type { Tag } from '@/@types/index';

export const useTagsStore = defineStore('tags', () => {
  const tags = ref<Tag[]>([]);

  function tagById(id: string): Tag | undefined {
    return tags.value.find((tag) => tag.id === id);
  }

  async function fetchTags(): Promise<void> {
    tags.value = await tagApi.list();
  }

  async function createTag(payload: { name: string; color?: string | null }): Promise<Tag> {
    const created = await tagApi.create(payload);
    await fetchTags();
    return created;
  }

  async function updateTag(id: string, payload: { name?: string; color?: string | null }): Promise<void> {
    await tagApi.update(id, payload);
    await fetchTags();
  }

  async function deleteTag(id: string): Promise<void> {
    await tagApi.delete(id);
    await fetchTags();
  }

  return {
    tags,
    tagById,
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
  };
});
