<script setup lang="ts">
import { computed, ref } from 'vue'
import { addExchange, updateExchange } from '../lib/data'
import type { Exchange } from '../lib/db'
import { today } from '../lib/db'
import { formatRate } from '../lib/format'
import SheetModal from './SheetModal.vue'
import Vnd from './Vnd.vue'
import VndField from './VndField.vue'

const props = defineProps<{ exchange?: Exchange | null }>()
const emit = defineEmits<{ close: [] }>()

const rub = ref<number | null>(props.exchange?.rub ?? null)
const vnd = ref<number | null>(props.exchange?.vnd ?? null)
// Дата редактируется: перевод можно записать задним числом, и тогда FIFO
// сам пересчитает курс у всех трат после него.
const date = ref(props.exchange?.date ?? today())
const saving = ref(false)

const canSave = computed(() => !!rub.value && rub.value > 0 && !!vnd.value && vnd.value > 0)
const rate = computed(() => (canSave.value ? formatRate(rub.value!, vnd.value!) : null))

async function save() {
  if (!canSave.value || saving.value) return
  saving.value = true
  try {
    if (props.exchange) {
      await updateExchange(props.exchange.id, { rub: rub.value!, vnd: vnd.value!, date: date.value })
    } else {
      await addExchange({ rub: rub.value!, vnd: vnd.value!, date: date.value })
    }
    emit('close')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <SheetModal :title="exchange ? 'Перевод' : 'Новый перевод'" @close="emit('close')">
    <label class="flex flex-col gap-1.5">
      <span class="text-xs text-muted">Отдала</span>
      <div class="relative">
        <input v-model.number="rub" type="number" inputmode="numeric" min="0" placeholder="10000" class="field pr-10 text-xl" />
        <span class="absolute right-4 top-1/2 -translate-y-1/2 text-muted">₽</span>
      </div>
    </label>

    <VndField v-model="vnd" label="Получила" placeholder="3000" />

    <p v-if="rate" class="text-sm flex flex-wrap items-baseline gap-x-2">
      <Vnd :value="vnd ?? 0" class="text-ink" />
      <span class="text-exchange">Курс: {{ rate }}</span>
    </p>

    <label class="flex flex-col gap-1.5">
      <span class="text-xs text-muted">Дата</span>
      <input v-model="date" type="date" class="field" />
    </label>

    <button
      type="button"
      :disabled="!canSave || saving"
      class="w-full rounded-2xl py-3 text-white font-medium bg-accent disabled:opacity-40"
      @click="save"
    >
      {{ saving ? 'Сохраняю…' : 'Сохранить' }}
    </button>
  </SheetModal>
</template>
