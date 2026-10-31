<script setup lang="ts">
import { formatDate, todayLabel } from '../lib/format'
import Vnd from './Vnd.vue'

/** Полоска между днями в списке трат: дата слева, сумма за день справа. */
defineProps<{ date: string; total: number }>()
</script>

<template>
  <div
    class="flex items-baseline justify-between gap-2 px-4 py-1.5 text-[11px] uppercase tracking-wide text-muted"
    :style="{ background: 'color-mix(in srgb, var(--line) 35%, transparent)' }"
  >
    <span>{{ todayLabel(date) ?? formatDate(date) }}</span>
    <span class="normal-case"><Vnd :value="total" /></span>
  </div>
</template>
