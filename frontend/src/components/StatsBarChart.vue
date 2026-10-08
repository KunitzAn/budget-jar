<template>
  <div class="chart-scroll">
    <div class="chart">
      <div v-for="p in points" :key="p.key" class="bar-col">
        <span class="bar-value" :class="toneOf(p.value)">{{ formatShort(p.value) }}</span>
        <div class="bar-track">
          <div class="bar" :class="toneOf(p.value)" :style="{ height: barHeight(p.value) + '%' }"></div>
        </div>
        <span class="bar-label">{{ p.shortLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    points: { key: string; shortLabel: string; value: number }[]
    // 'spent' — все значения расходные, красим их расходным цветом, а не радугой
    variant?: 'saved' | 'spent'
  }>(),
  { variant: 'saved' },
)

const toneOf = (value: number) =>
  props.variant === 'spent' ? 'spend' : value >= 0 ? 'positive' : 'negative'

const maxAbs = computed(() => Math.max(1, ...props.points.map((p) => Math.abs(p.value))))

const barHeight = (value: number) => Math.max(4, (Math.abs(value) / maxAbs.value) * 100)

const formatShort = (value: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)
</script>

<style scoped>
.chart-scroll {
  overflow-x: auto;
}

.chart {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  min-height: 160px;
  padding: 0 0.25rem;
}

.bar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  min-width: 3.25rem;
}

.bar-value {
  font-size: 0.6875rem;
  font-weight: 600;
  white-space: nowrap;
}

.bar-value.positive {
  color: var(--success);
}

.bar-value.negative,
.bar-value.spend {
  color: var(--danger);
}

.bar-track {
  width: 1.75rem;
  height: 100px;
  display: flex;
  align-items: flex-end;
}

.bar {
  width: 100%;
  border-radius: 6px 6px 3px 3px;
  transition: height 0.3s ease;
}

.bar.positive {
  background: var(--gradient-rainbow);
}

.bar.negative {
  background: var(--danger);
  opacity: 0.7;
}

.bar.spend {
  background: linear-gradient(180deg, var(--accent-pink), var(--danger));
}

.bar-label {
  font-size: 0.6875rem;
  color: var(--text-secondary);
  white-space: nowrap;
}
</style>
