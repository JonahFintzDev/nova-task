import { onMounted, onUnmounted, ref, type Ref } from 'vue';

import type { UiThemeMode } from '@/lib/tagColors';

function readDataTheme(): UiThemeMode {
  const v = document.documentElement.getAttribute('data-theme');
  return v === 'light' ? 'light' : 'dark';
}

/** Tracks `document.documentElement[data-theme]` so tag colors stay readable after theme changes. */
export function useDataTheme(): Ref<UiThemeMode> {
  const mode = ref<UiThemeMode>(typeof document !== 'undefined' ? readDataTheme() : 'dark');

  onMounted(() => {
    mode.value = readDataTheme();
    const observer = new MutationObserver(() => {
      mode.value = readDataTheme();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    onUnmounted(() => observer.disconnect());
  });

  return mode;
}
