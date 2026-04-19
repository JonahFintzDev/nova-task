<script setup lang="ts">
// node_modules
import { onMounted, ref, watch } from 'vue';
import { VueDatePicker } from '@vuepic/vue-datepicker';
import dayjs from 'dayjs';
import { CalendarIcon, ClockIcon } from 'lucide-vue-next';

// -------------------------------------------------- Props --------------------------------------------------
const modelDate = defineModel<Date | null>('date', { required: true });
const modelHasTime = defineModel<boolean>('hasTime', { required: true });
const props = withDefaults(
  defineProps<{
    placeholder?: string;
    clearable?: boolean;
    autoApply?: boolean;
    disabled?: boolean;
  }>(),
  {
    placeholder: '',
    clearable: true,
    autoApply: true,
    disabled: false,
  },
);
// -------------------------------------------------- Refs --------------------------------------------------
const time = ref<{
  hours: number;
  minutes: number;
} | null>(null);
const applyTimeNextChange = ref(false);
const timePickerRef = ref<InstanceType<typeof VueDatePicker> | null>(null);

// -------------------------------------------------- Computed --------------------------------------------------

// -------------------------------------------------- Methods --------------------------------------------------
const parseModelValue = () => {
  if (modelDate.value && modelHasTime.value) {
    time.value = {
      hours: modelDate.value.getHours(),
      minutes: modelDate.value.getMinutes(),
    };
  } else {
    time.value = null;
  }
};

const onTimeUpdate = () => {
  if (applyTimeNextChange.value) {
    applyTimeNextChange.value = false;

    // close time picker
    timePickerRef.value?.closeMenu();
    return;
  }

  if (!modelHasTime.value) {
    applyTimeNextChange.value = true;
  } else {
    applyTimeNextChange.value = false;
  }
};

// -------------------------------------------------- Emits --------------------------------------------------

onMounted(() => {
  parseModelValue();
});
watch(modelHasTime, (newValue, oldValue) => {
  if (oldValue != newValue) {
    parseModelValue();
  }
});
watch(modelDate, (newValue, oldValue) => {
  if (oldValue != newValue) {
    parseModelValue();
  }
});
watch(time, (newValue, oldValue) => {
  if (
    (oldValue?.hours !== newValue?.hours || oldValue?.minutes !== newValue?.minutes) &&
    modelDate.value
  ) {
    if (newValue === null) {
      modelHasTime.value = false;
      return;
    }

    modelHasTime.value = true;
    modelDate.value = dayjs(modelDate.value)
      .set('hour', time.value?.hours ?? 0)
      .set('minute', time.value?.minutes ?? 0)
      .toDate();
  }
});
</script>

<template>
  <div class="bg-input border border-border rounded-lg overflow-hidden">
    <VueDatePicker
      v-model="modelDate"
      :auto-apply="true"
      :time-config="{ enableTimePicker: false }"
      :clearable="true"
      :placeholder="props.placeholder"
    >
      <template #input-icon>
        <CalendarIcon class="ml-2.5 w-4 h-4" />
      </template>
    </VueDatePicker>
  </div>
  <div
    class="mt-2 bg-input border border-border rounded-lg overflow-hidden"
    :class="{
      'opacity-50': !modelDate,
      'is-empty': !modelHasTime,
    }"
  >
    <VueDatePicker
      v-model="time"
      :formats="{
        input: 'HH:mm',
      }"
      ref="timePickerRef"
      :time-picker="true"
      :clearable="true"
      placeholder="-"
      :auto-apply="true"
      :disabled="props.disabled || !modelDate"
      @cleared="modelHasTime = false"
      @update:model-value="onTimeUpdate"
      :flow="modelHasTime ? undefined : { steps: ['hours', 'minutes'], partial: true }"
    >
      <template #input-icon>
        <ClockIcon class="ml-2.5 w-4 h-4" />
      </template>
    </VueDatePicker>
  </div>
</template>

<style>
.dp__input {
  border: 0 !important;
  box-shadow: none !important;
}
.is-empty .dp__input {
  text-align: center !important;
}

.dp__input:hover,
.dp__input_focus,
.dp__input:focus {
  border: 0 !important;
  box-shadow: none !important;
}
.dp__input_wrap .dp__input {
  padding-left: 36px !important;
}
</style>
