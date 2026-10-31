<script setup lang="ts">
import { computed } from 'vue'
import { VND_UNIT } from '../lib/format'

/**
 * Ввод суммы в донгах — в тысячах. Три нуля в конце есть у любой здешней
 * суммы, набирать их каждый раз незачем; серое «000» у правого края поля
 * показывает, что они дописываются сами.
 *
 * Дробь разрешена: 450,5 — это 450 500 ₫, иначе некруглую сумму было бы не
 * ввести вовсе.
 */
const props = defineProps<{ modelValue: number | null; label: string; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [number | null] }>()

const thousands = computed({
  get: () => (props.modelValue === null ? null : props.modelValue / VND_UNIT),
  set: (value) => emit('update:modelValue', value === null ? null : Math.round(value * VND_UNIT)),
})
</script>

<template>
  <label class="flex flex-col gap-1.5">
    <span class="text-xs text-muted">{{ label }}</span>
    <div class="relative">
      <input
        v-model.number="thousands"
        type="number"
        inputmode="decimal"
        step="any"
        min="0"
        :placeholder="placeholder"
        class="field pr-20 text-xl"
      />
      <span class="absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
        <span class="opacity-50">000</span> ₫
      </span>
    </div>
  </label>
</template>
