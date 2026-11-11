<script setup lang="ts">
import { Trash2 } from '@lucide/vue'
import { computed, ref } from 'vue'
import type { Category, Expense } from '../lib/db'
import { formatDate, formatRub } from '../lib/format'
import Vnd from './Vnd.vue'
import { iconComponent } from '../lib/icons'

const props = defineProps<{
  expense: Expense
  category: Category | undefined
  rub: number
  /** Дата нужна в общем списке и не нужна внутри одного дня. */
  withDate?: boolean
  /** Внутри одной статьи её имя в каждой строке только мешает. */
  hideCategory?: boolean
}>()

const emit = defineEmits<{ open: []; remove: [] }>()

const categoryName = computed(() => props.category?.name ?? 'Удалённая статья')
// Если статья и так известна, наверх поднимаем заметку — она здесь главное.
const title = computed(() =>
  props.hideCategory && props.expense.comment ? props.expense.comment : categoryName.value,
)
const note = computed(() => (props.expense.comment === title.value ? '' : props.expense.comment))

/**
 * Смахивание влево открывает «Удалить». Жест разбираем сами, а не берём
 * библиотеку: нужно всего одно направление, зато важно не отнимать у списка
 * вертикальную прокрутку — поэтому до первого движения не решаем ничего, а
 * дальше направление выбирается один раз и до конца жеста не меняется.
 */
const ACTION_WIDTH = 92

const offset = ref(0)
const dragging = ref(false)

let startX = 0
let startY = 0
let startOffset = 0
let axis: 'none' | 'x' | 'y' = 'none'

function onDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  startX = event.clientX
  startY = event.clientY
  startOffset = offset.value
  axis = 'none'
  dragging.value = true
}

function onMove(event: PointerEvent) {
  if (!dragging.value) return
  const dx = event.clientX - startX
  const dy = event.clientY - startY

  if (axis === 'none') {
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
    axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    if (axis === 'x') (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }
  if (axis !== 'x') return

  // вправо дальше закрытого положения не тянем — открывать там нечего
  offset.value = Math.min(0, Math.max(-ACTION_WIDTH, startOffset + dx))
}

function onUp() {
  if (!dragging.value) return
  dragging.value = false
  if (axis === 'x') offset.value = offset.value < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0
}

function onRowClick() {
  // открытую строку первым касанием закрываем, а не проваливаемся в правку
  if (offset.value !== 0) {
    offset.value = 0
    return
  }
  if (axis === 'x') return
  emit('open')
}

function handleRemove() {
  offset.value = 0
  emit('remove')
}
</script>

<template>
  <div class="relative overflow-hidden">
    <!-- Пока строку не потянули, кнопки нет совсем: строка прозрачная, и
         красный фон просвечивал бы сквозь неё. -->
    <button
      v-if="offset !== 0"
      type="button"
      class="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-white"
      :style="{ width: `${ACTION_WIDTH}px`, background: 'var(--spend)' }"
      @click="handleRemove"
    >
      <Trash2 :size="16" />
      Удалить
    </button>

    <div
      class="relative"
      :style="{
        transform: `translateX(${offset}px)`,
        background: offset !== 0 ? 'var(--card-solid)' : undefined,
        transition: dragging ? 'none' : 'transform 0.18s ease',
        touchAction: 'pan-y',
      }"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <button type="button" class="w-full flex items-center gap-3 px-4 py-3 text-left" @click="onRowClick">
        <span
          class="shrink-0 w-9 h-9 rounded-xl grid place-items-center"
          :style="{ background: 'color-mix(in srgb, var(--spend) 14%, transparent)', color: 'var(--spend)' }"
        >
          <component :is="iconComponent(category?.icon ?? 'Ellipsis')" :size="18" />
        </span>

        <span class="min-w-0 flex-1 flex flex-col">
          <span class="text-sm text-ink truncate">{{ title }}</span>
          <span class="text-xs text-muted truncate">
            <template v-if="withDate">{{ formatDate(expense.date) }}</template>
            <template v-if="withDate && note"> · </template>
            <template v-if="note">{{ note }}</template>
          </span>
        </span>

        <span class="shrink-0 flex flex-col items-end">
          <span class="text-sm font-medium text-ink"><Vnd :value="expense.vnd" /></span>
          <span class="text-xs text-muted">{{ formatRub(rub) }}</span>
        </span>
      </button>
    </div>
  </div>
</template>
