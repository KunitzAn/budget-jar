<template>
  <div class="chart-scroll">
    <div class="chart">
      <div v-for="p in points" :key="p.key" class="bar-col">
        <span class="bar-value" :class="p.value >= 0 ? 'positive' : 'negative'">{{ formatShort(p.value) }}</span>
        <div class="bar-track">
          <div
            class="bar"
            :class="p.value >= 0 ? 'positive' : 'negative'"
            :style="{ height: barHeight(p.value) + '%' }"
          ></div>
        </div>
        <span class="bar-label">{{ p.shortLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  points: { key: string; shortLabel: string; value: number }[]
}>()

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

.bar-value.negative {
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

.bar-label {
  font-size: 0.6875rem;
  color: var(--text-secondary);
  white-space: nowrap;
}
</style>
