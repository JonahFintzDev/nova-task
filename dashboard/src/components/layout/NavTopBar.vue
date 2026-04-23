<script setup lang="ts">
// node_modules
import { Download, LogOut, Menu, Search, Settings } from 'lucide-vue-next';
import { onMounted, onUnmounted, ref } from 'vue';

// lib
import { dropdownEnter, dropdownLeave } from '@/lib/gsap';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

// components
import UserAvatar from '@/components/shared/UserAvatar.vue';

// composables
import { usePWAInstall } from '@/composables/usePWAInstall';

// stores
import { useAuthStore } from '@/stores/auth';

// -------------------------------------------------- Props --------------------------------------------------
defineProps<{
  title: string;
}>();

// -------------------------------------------------- Emits --------------------------------------------------
const emit = defineEmits<{
  (event: 'search'): void;
  (event: 'menu'): void;
}>();

// -------------------------------------------------- Store --------------------------------------------------
const authStore = useAuthStore();
const { t } = useI18n();

// -------------------------------------------------- PWA Install --------------------------------------------------
const { isInstallable, installPWA } = usePWAInstall();

// -------------------------------------------------- Data --------------------------------------------------
const bMenu = ref(false);
const menuRoot = ref<HTMLElement | null>(null);

// -------------------------------------------------- Methods --------------------------------------------------
const logout = (): void => {
  authStore.logout();
  window.location.href = '/login';
};

const onDocumentClick = (event: MouseEvent): void => {
  if (!bMenu.value || !menuRoot.value) {
    return;
  }
  if (!menuRoot.value.contains(event.target as Node)) {
    bMenu.value = false;
  }
};

// -------------------------------------------------- Lifecycle --------------------------------------------------
onMounted(() => {
  document.addEventListener('click', onDocumentClick);
});

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick);
});
</script>

<template>
  <header
    class="relative z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4"
    :class="'border-border bg-surface/90 backdrop-blur-md'"
  >
    <div class="flex min-w-0 items-center gap-3">
      <button
        type="button"
        class="button is-icon is-transparent lg:!hidden"
        @click="emit('menu')"
      >
        <Menu class="h-5 w-5" />
      </button>
      <h2 class="min-w-0 truncate text-sm font-semibold lg:text-base">{{ title }}</h2>
    </div>
    <div class="flex flex-1 items-center justify-end gap-2">
      <button
        type="button"
        class="hidden sm:flex items-center gap-2 h-9 max-w-72 flex-1 rounded-lg border border-border bg-bg px-3 text-sm text-text-muted hover:border-primary/40 hover:bg-bg transition-colors"
        :title="t('nav.search')"
        @click="emit('search')"
      >
        <Search class="h-4 w-4 shrink-0" />
        <span class="flex-1 text-left">{{ t('nav.search') }}…</span>
        <kbd class="hidden md:inline-flex items-center gap-0.5 rounded border border-border px-1.5 text-[10px] text-text-muted/70">⌘K</kbd>
      </button>
      <button
        type="button"
        class="button is-icon is-transparent sm:!hidden"
        :title="t('nav.search')"
        @click="emit('search')"
      >
        <Search class="h-5 w-5" />
      </button>
      <button
        v-if="isInstallable"
        type="button"
        class="button is-icon is-transparent"
        :title="t('nav.install_app')"
        @click="installPWA()"
      >
        <Download class="h-5 w-5" />
      </button>
      <div ref="menuRoot" class="relative">
        <button
          type="button"
          class="flex items-center justify-center h-9 w-9 rounded-full border border-border bg-bg overflow-hidden hover:opacity-90 transition-opacity"
          @click.stop="bMenu = !bMenu"
        >
          <UserAvatar
            :username="authStore.username ?? ''"
            :avatar-url="authStore.avatarUrl"
            size="md"
          />
        </button>
        <Transition name="gsap-dropdown" :css="false" @enter="dropdownEnter" @leave="dropdownLeave">
          <div
            v-if="bMenu"
            class="absolute right-0 top-full z-50 mt-1 min-w-44 rounded-md border py-1 shadow-lg"
            :class="'border-border bg-surface'"
          >
            <RouterLink
              to="/settings"
              class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-fg/[0.05]"
              @click="bMenu = false"
            >
              <Settings class="h-4 w-4 shrink-0" />
              {{ t('nav.settings') }}
            </RouterLink>
            <button
              type="button"
              class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-fg/[0.05]"
              @click="
                bMenu = false;
                logout();
              "
            >
              <LogOut class="h-4 w-4 shrink-0" />
              {{ t('nav.logout') }}
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </header>
</template>
