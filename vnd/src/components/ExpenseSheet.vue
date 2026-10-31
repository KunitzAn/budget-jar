<script setup lang="ts">
import { computed, ref } from 'vue'
import { addExpense, updateExpense } from '../lib/data'
import type { Category, Expense } from '../lib/db'
import { today } from '../lib/db'
import { computeFifo } from '../lib/fifo'
import { formatRub } from '../lib/format'
import { iconComponent } from '../lib/icons'
import type { Exchange } from '../lib/db'
import SheetModal from './SheetModal.vue'
import Vnd from './Vnd.vue'
import VndField from './VndField.vue'

const props = defineProps<{
  categories: Category[]
  exchanges: Exchange[]
  expenses: Expense[]
  /** Передан — правим существующую трату, иначе заводим новую. */
  expense?: Expense | null
}>()

const emit = defineEmits<{ close: [] }>()

const vnd = ref<number | null>(props.expense?.vnd ?? null)
const date = ref(props.expense?.date ?? today())
const comment = ref(props.expense?.comment ?? '')
// Статья обязательна: по умолчанию та же, что в прошлый раз, иначе первая
const categoryId = ref(props.expense?.categoryId ?? props.categories[0]?.id ?? '')
const saving = ref(false)

const canSave = computed(() => !!vnd.value && vnd.value > 0 && !!categoryId.value)

/**
 * Во что обойдётся трата в рублях. Считаем полным FIFO вместе с черновиком,
 * а не «по текущему курсу»: трата может разойтись между двумя переводами, и
 * подсказка обязана показывать то же, что потом окажется в статистике.
 */
const preview = computed(() => {
  if (!vnd.value || vnd.value <= 0) return null
  const draftId = props.expense?.id ?? '__draft__'
  const others = props.expenses.filter((e) => e.id !== draftId)
  const result = computeFifo(
    props.exchanges.map((x) => ({ id: x.id, date: x.date, rub: x.rub, vnd: x.vnd, createdAt: x.createdAt })),
    [
      ...others.map((e) => ({
        id: e.id,
        date: e.date,
        vnd: e.vnd,
        categoryId: e.categoryId,
        createdAt: e.createdAt,
      })),
      {
        id: draftId,
        date: date.value,
        vnd: vnd.value,
        categoryId: categoryId.value,
        createdAt: props.expense?.createdAt ?? new Date().toISOString(),
      },
    ],
  )
  const rub = result.rubByExpense.get(draftId) ?? 0
  const chunks = result.chunksByExpense.get(draftId) ?? []
  const short = chunks.some((c) => c.exchangeId === null)
  return { rub, short }
})

async function save() {
  if (!canSave.value || saving.value) return
  saving.value = true
  try {
    if (props.expense) {
      await updateExpense(props.expense.id, {
        vnd: vnd.value!,
        date: date.value,
        categoryId: categoryId.value,
        comment: comment.value,
      })
    } else {
      await addExpense({ vnd: vnd.value!, date: date.value, categoryId: categoryId.value, comment: comment.value })
    }
    emit('close')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <SheetModal :title="expense ? 'Трата' : 'Новая трата'" @close="emit('close')">
    <VndField v-model="vnd" label="Сколько потратили" placeholder="150" />

    <p v-if="preview" class="text-sm flex flex-wrap items-baseline gap-x-2">
      <Vnd :value="vnd ?? 0" class="text-ink" />
      <span :class="preview.short ? 'text-warn' : 'text-rub'">
        ≈ {{ formatRub(preview.rub) }}
        <span v-if="preview.short"> — переведённого не хватает, добавьте перевод</span>
      </span>
    </p>

    <div class="flex flex-col gap-1.5">
      <span class="text-xs text-muted">Статья</span>
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="c in categories"
          :key="c.id"
          type="button"
          class="flex flex-col items-center gap-1 rounded-2xl py-2.5 px-1 border transition-colors"
          :style="
            categoryId === c.id
              ? { borderColor: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }
              : { borderColor: 'var(--line)' }
          "
          @click="categoryId = c.id"
        >
          <component :is="iconComponent(c.icon)" :size="20" :style="{ color: 'var(--accent)' }" />
          <span class="text-[10px] leading-tight text-center text-ink line-clamp-2">{{ c.name }}</span>
        </button>
      </div>
    </div>

    <label class="flex flex-col gap-1.5">
      <span class="text-xs text-muted">Комментарий — необязательно</span>
      <input v-model="comment" type="text" placeholder="на что" class="field" />
    </label>

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
