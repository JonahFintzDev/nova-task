<script setup lang="ts">
// node_modules
import { X } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

// components
import ColorPicker from '@/components/shared/ColorPicker.vue';
import GsapModal from '@/components/shared/GsapModal.vue';
import IconPicker from '@/components/shared/IconPicker.vue';

// stores
import { useListsStore } from '@/stores/lists';

// types
import type { List } from '@/@types/index';

// -------------------------------------------------- Props --------------------------------------------------

const props = defineProps<{
  isOpen: boolean;
  list?: List | null;
}>();

// -------------------------------------------------- Emits --------------------------------------------------

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'saved', list: List): void;
}>();

// -------------------------------------------------- Store --------------------------------------------------

const listsStore = useListsStore();
const { t } = useI18n();

// -------------------------------------------------- Data --------------------------------------------------

const title = ref('');
const category = ref('');
const color = ref<string | null>(null);
const icon = ref<string | null>(null);
const bSaving = ref(false);

// -------------------------------------------------- Computed --------------------------------------------------

const categoryOptions = computed(() => {
  const set = new Set<string>();
  for (const list of listsStore.lists) {
    if (list.category?.trim()) {
      set.add(list.category.trim());
    }
  }
  return [...set].sort();
});

// -------------------------------------------------- Watchers --------------------------------------------------

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      if (props.list) {
        title.value = props.list.title;
        category.value = props.list.category ?? '';
        color.value = props.list.color;
        icon.value = props.list.icon;
      } else {
        title.value = '';
        category.value = '';
        color.value = null;
        icon.value = null;
      }
    }
  },
);

// -------------------------------------------------- Methods --------------------------------------------------

function close(): void {
  emit('close');
}

async function save(): Promise<void> {
  if (!title.value.trim()) {
    return;
  }
  bSaving.value = true;
  try {
    if (props.list) {
      await listsStore.updateList(props.list.id, {
        title: title.value.trim(),
        category: category.value.trim() || null,
        color: color.value,
        icon: icon.value,
      });
      const updated = listsStore.listById(props.list.id);
      if (updated) {
        emit('saved', updated);
      }
    } else {
      const created = await listsStore.createList({
        title: title.value.trim(),
        category: category.value.trim() || null,
        color: color.value,
        icon: icon.value,
      });
      emit('saved', created);
    }
    close();
  } finally {
    bSaving.value = false;
  }
}
</script>

<template>
  <GsapModal :show="props.isOpen">
    <div class="modal-backdrop" @click="close" />
    <div class="modal-panel max-w-xl">
      <div class="modal-header !items-start !border-b-0 !pb-2">
        <div>
          <h2 class="text-3xl font-bold text-text-primary">
            {{ props.list ? t('list.editTitle') : t('list.createTitle') }}
          </h2>
          <p class="mt-1 text-sm text-text-muted">{{ t('list.modalSubtitle') }}</p>
        </div>
        <button type="button" class="close-button" @click="close">
          <X class="h-5 w-5" />
        </button>
      </div>
      <div class="modal-body space-y-5 !pt-3">
        <div class="field">
          <label
            class="label !mb-2 !text-[11px] !font-semibold !uppercase !tracking-[0.18em] !text-text-muted"
          >
            {{ t('list.name') }}
          </label>
          <input
            v-model="title"
            type="text"
            :placeholder="t('list.namePlaceholder')"
            class="!h-10 !rounded-lg !border-0 !bg-bg"
          />
        </div>
        <div class="field">
          <label
            class="label !mb-2 !text-[11px] !font-semibold !uppercase !tracking-[0.18em] !text-text-muted"
          >
            {{ t('list.category') }}
          </label>
          <input
            v-model="category"
            type="text"
            :placeholder="t('list.categoryPlaceholder')"
            class="!h-10 !rounded-lg !border-0 !bg-bg"
          />
          <div v-if="categoryOptions.length" class="mt-2">
            <p class="mb-1 text-[10px] uppercase tracking-wide text-text-muted">
              {{ t('list.pickCategory') }}
            </p>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="c in categoryOptions"
                :key="c"
                type="button"
                class="rounded-full border border-border bg-input px-2 py-0.5 text-xs hover:border-primary"
                @click="category = c"
              >
                {{ c }}
              </button>
            </div>
          </div>
        </div>
        <div class="field">
          <label
            class="label !mb-2 !text-[11px] !font-semibold !uppercase !tracking-[0.18em] !text-text-muted"
          >
            {{ t('list.chooseIcon') }}
          </label>
          <IconPicker v-model="icon" />
        </div>
        <div class="field">
          <label
            class="label !mb-2 !text-[11px] !font-semibold !uppercase !tracking-[0.18em] !text-text-muted"
          >
            {{ t('list.color') }}
          </label>
          <ColorPicker v-model="color" />
        </div>
      </div>
      <div class="modal-footer border-t-0! bg-bg/80!">
        <button
          type="button"
          class="button !border-0 !bg-transparent hover:!bg-fg/[0.05]"
          @click="close"
        >
          {{ t('common.cancel') }}
        </button>
        <button type="button" class="button is-primary !px-6" :disabled="bSaving" @click="save">
          {{ props.list ? t('common.save') : t('list.createCta') }}
        </button>
      </div>
    </div>
  </GsapModal>
</template>
