<script setup lang="ts">
import { computed } from 'vue'
import { splitVnd } from '../lib/format'

/**
 * Сумма в донгах. Последние три нуля бледнее остального: они одинаковые у
 * всех сумм и мешают с одного взгляда поймать значащие цифры.
 */
const props = defineProps<{ value: number }>()

const parts = computed(() => splitVnd(props.value))
</script>

<template>
  <span class="whitespace-nowrap"
    >{{ parts.head }}<span class="opacity-40">{{ parts.tail }}</span> ₫</span
  >
</template>
