<template>
  <div class="jar-container">
    <svg class="jar" viewBox="0 0 200 400" xmlns="http://www.w3.org/2000/svg">
      <!-- Банка -->
      <path
        d="M 40 50 L 40 350 Q 40 380 70 380 L 130 380 Q 160 380 160 350 L 160 50 Q 160 30 140 30 L 60 30 Q 40 30 40 50"
        fill="none"
        stroke="#C4A57B"
        stroke-width="3"
      />
      
      <!-- Горлышко -->
      <rect x="70" y="10" width="60" height="25" rx="5" fill="none" stroke="#C4A57B" stroke-width="3" />
      
      <!-- Камушки -->
      <g v-if="currentBalance >= 0">
        <ellipse
          v-for="(stone, i) in stones"
          :key="i"
          :cx="stone.cx"
          :cy="stone.cy"
          :rx="stone.rx"
          :ry="stone.ry"
          :fill="stone.color"
          :transform="`rotate(${stone.rotate}, ${stone.cx}, ${stone.cy})`"
          opacity="0.85"
        />
      </g>
    </svg>

    <div class="balance-display" :class="{ negative: currentBalance < 0 }">
      {{ formatCurrency(currentBalance) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  currentBalance: number
  maxPossible: number
}>()

const colors = ['#E8C4A0', '#D4A574', '#C4612F', '#F2E3D6', '#E7D7C1', '#B8956A']

const stones = computed(() => {
  if (props.currentBalance <= 0) return []
  
  const fillRatio = Math.min(props.currentBalance / props.maxPossible, 1)
  const stoneCount = Math.floor(fillRatio * 50) + 10
  const maxHeight = 330
  const minHeight = 350
  const fillHeight = minHeight - (fillRatio * (minHeight - maxHeight))
  
  return Array.from({ length: stoneCount }, () => ({
    cx: 60 + Math.random() * 80,
    cy: fillHeight + Math.random() * (350 - fillHeight),
    rx: 8 + Math.random() * 8,
    ry: 6 + Math.random() * 6,
    rotate: Math.random() * 360,
    color: colors[Math.floor(Math.random() * colors.length)],
  }))
})

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
  }).format(value)
}
</script>

<style scoped>
.jar-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.jar {
  width: 100%;
  max-width: 300px;
  height: auto;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.1));
}

.balance-display {
  font-size: 2.5rem;
  font-weight: 600;
  color: #1F2421;
}

.balance-display.negative {
  color: #dc2626;
}
</style>
