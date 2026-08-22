<template>
  <div class="jar-container">
    <svg class="jar" viewBox="0 0 200 400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="jarStroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ff6fa5" />
          <stop offset="35%" stop-color="#ffa15c" />
          <stop offset="65%" stop-color="#4fc3f7" />
          <stop offset="100%" stop-color="#9b6bff" />
        </linearGradient>
        <radialGradient id="dustGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
        <clipPath id="jarClip">
          <path d="M 41 52 L 41 349 Q 41 379 70 379 L 130 379 Q 159 379 159 349 L 159 52 Q 159 32 141 32 L 59 32 Q 41 32 41 52" />
        </clipPath>
      </defs>

      <!-- Банка -->
      <path
        d="M 40 50 L 40 350 Q 40 380 70 380 L 130 380 Q 160 380 160 350 L 160 50 Q 160 30 140 30 L 60 30 Q 40 30 40 50"
        fill="none"
        stroke="url(#jarStroke)"
        stroke-width="3"
      />

      <!-- Горлышко -->
      <rect x="70" y="10" width="60" height="25" rx="5" fill="none" stroke="url(#jarStroke)" stroke-width="3" />

      <!-- Волшебная пыльца -->
      <g v-if="currentBalance > 0" clip-path="url(#jarClip)">
        <g v-for="dust in dustParticles" :key="dust.id">
          <circle
            v-if="!dust.star"
            :cx="dust.cx"
            :cy="dust.cy"
            :r="dust.r * 2.4"
            fill="url(#dustGlow)"
            class="twinkle"
            :style="{ animationDelay: `${dust.delay}s`, animationDuration: `${dust.duration}s` }"
          />
          <circle
            v-if="!dust.star"
            :cx="dust.cx"
            :cy="dust.cy"
            :r="dust.r"
            :fill="dust.color"
            class="twinkle"
            :style="{ animationDelay: `${dust.delay}s`, animationDuration: `${dust.duration}s` }"
          />
          <path
            v-else
            :d="starPath(dust.cx, dust.cy, dust.r * 1.8)"
            :fill="dust.color"
            class="twinkle"
            :style="{ animationDelay: `${dust.delay}s`, animationDuration: `${dust.duration}s` }"
          />
        </g>
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
  totalSum: number
}>()

const colors = ['#ff6fa5', '#ffa15c', '#ffd54f', '#4fc3f7', '#9b6bff', '#ff8fc4', '#7fe0d0']

const starPath = (cx: number, cy: number, r: number) => {
  const points = []
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i
    const radius = i % 2 === 0 ? r : r * 0.4
    points.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`)
  }
  return `M ${points.join(' L ')} Z`
}

const dustParticles = computed(() => {
  if (props.currentBalance <= 0) return []

  const fillRatio = Math.max(0, Math.min(props.currentBalance / props.totalSum, 1))
  const particleCount = Math.floor(fillRatio * 380) + 35
  const maxHeight = 38 // доверху, у самого горлышка
  const minHeight = 350 // почти пусто
  const bottomY = 377 // самое дно банки
  const fillHeight = minHeight - (fillRatio * (minHeight - maxHeight))

  return Array.from({ length: particleCount }, (_, i) => ({
    id: i,
    cx: 44 + Math.random() * 112,
    cy: fillHeight + Math.random() * (bottomY - fillHeight),
    r: 1.2 + Math.random() * 2.6,
    color: colors[Math.floor(Math.random() * colors.length)],
    star: Math.random() < 0.08,
    delay: Math.random() * 3,
    duration: 1.6 + Math.random() * 1.8,
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
  filter: drop-shadow(0 8px 24px rgba(155, 107, 255, 0.25));
}

.twinkle {
  animation-name: twinkle;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
  transform-box: fill-box;
  transform-origin: center;
}

@keyframes twinkle {
  0%, 100% {
    opacity: 0.35;
    transform: scale(0.85);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}

.balance-display {
  font-size: 2.5rem;
  font-weight: 600;
  background: var(--gradient-rainbow);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.balance-display.negative {
  background: none;
  -webkit-background-clip: initial;
  background-clip: initial;
  color: var(--danger);
}
</style>
