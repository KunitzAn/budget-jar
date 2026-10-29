<script setup lang="ts">
import type { Bar } from '../lib/fifo'
import { formatDate, formatRate, formatRub, formatVnd } from '../lib/format'

const props = defineProps<{
  bar: Bar
  /** Крупная — та, из которой тратим прямо сейчас. */
  large?: boolean
}>()

// Полоса пустеет по мере трат. Совсем нулевую ширину не показываем: тонкая
// полоска читается как «кончилась», пустое место — как «что-то сломалось».
const width = () => (props.bar.percent > 0 ? Math.max(props.bar.percent, 2) : 0)
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-baseline justify-between gap-2">
      <span :class="large ? 'text-2xl font-semibold text-ink' : 'text-base font-medium text-ink'">
        {{ formatVnd(bar.remainingVnd) }}
      </span>
      <span :class="large ? 'text-base text-muted' : 'text-sm text-muted'">
        {{ Math.round(bar.percent) }}%
      </span>
    </div>

    <div class="rounded-full bg-line overflow-hidden" :class="large ? 'h-4' : 'h-2.5'">
      <div
        class="h-full rounded-full transition-[width] duration-300"
        :style="{ width: `${width()}%`, background: 'var(--vnd)' }"
      />
    </div>

    <div class="flex items-center justify-between gap-2 text-xs text-muted">
      <span>{{ formatDate(bar.date) }} · {{ formatRate(bar.rub, bar.vnd) }}</span>
      <span>≈ {{ formatRub(bar.remainingRub) }}</span>
    </div>
  </div>
</template>
