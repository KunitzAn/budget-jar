<script setup lang="ts">
import type { Category, Expense } from '../lib/db'
import { formatDate, formatRub } from '../lib/format'
import Vnd from './Vnd.vue'
import { iconComponent } from '../lib/icons'

defineProps<{
  expense: Expense
  category: Category | undefined
  rub: number
  /** Дата нужна в общем списке и не нужна внутри одного дня. */
  withDate?: boolean
}>()

const emit = defineEmits<{ open: [] }>()
</script>

<template>
  <button type="button" class="w-full flex items-center gap-3 px-4 py-3 text-left" @click="emit('open')">
    <span
      class="shrink-0 w-9 h-9 rounded-xl grid place-items-center"
      :style="{ background: 'color-mix(in srgb, var(--spend) 14%, transparent)', color: 'var(--spend)' }"
    >
      <component :is="iconComponent(category?.icon ?? 'Ellipsis')" :size="18" />
    </span>

    <span class="min-w-0 flex-1 flex flex-col">
      <span class="text-sm text-ink truncate">{{ category?.name ?? 'Удалённая статья' }}</span>
      <span class="text-xs text-muted truncate">
        <template v-if="withDate">{{ formatDate(expense.date) }}</template>
        <template v-if="withDate && expense.comment"> · </template>
        <template v-if="expense.comment">{{ expense.comment }}</template>
      </span>
    </span>

    <span class="shrink-0 flex flex-col items-end">
      <span class="text-sm font-medium text-ink"><Vnd :value="expense.vnd" /></span>
      <span class="text-xs text-muted">{{ formatRub(rub) }}</span>
    </span>
  </button>
</template>
