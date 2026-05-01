// node_modules
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

// classes
import { settingsApi } from '@/classes/api';

// types
import type { UserSettings } from '@/@types/index';

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<UserSettings | null>(null);
  const bLoaded = ref(false);

  const aiFeaturesDisabled = computed(() => settings.value?.aiFeaturesDisabled ?? false);

  async function load(options?: { force?: boolean }): Promise<UserSettings> {
    if (bLoaded.value && settings.value && options?.force !== true) {
      return settings.value;
    }
    const loaded = await settingsApi.get();
    settings.value = loaded;
    bLoaded.value = true;
    return loaded;
  }

  async function update(patch: Partial<UserSettings>): Promise<UserSettings> {
    const updated = await settingsApi.update(patch);
    settings.value = updated;
    bLoaded.value = true;
    return updated;
  }

  function clear(): void {
    settings.value = null;
    bLoaded.value = false;
  }

  return {
    settings,
    bLoaded,
    aiFeaturesDisabled,
    load,
    update,
    clear,
  };
});
