<script setup lang="ts">
import { X } from '@lucide/vue'

defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <!-- Шторка снизу: на телефоне до неё дотягивается большой палец, в отличие
       от диалога по центру экрана. -->
  <div class="fixed inset-0 z-40 flex flex-col justify-end" @click.self="emit('close')">
    <div class="absolute inset-0 bg-black/35" @click="emit('close')" />
    <div
      class="relative glass rounded-t-3xl !border-b-0 max-h-[88dvh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1rem)]"
    >
      <div class="sticky top-0 glass !border-0 !shadow-none flex items-center justify-between px-5 py-4">
        <h2 class="text-lg font-semibold text-ink">{{ title }}</h2>
        <button type="button" class="p-1 text-muted" aria-label="Закрыть" @click="emit('close')">
          <X :size="22" />
        </button>
      </div>
      <div class="px-5 pb-2 flex flex-col gap-4">
        <slot />
      </div>
    </div>
  </div>
</template>
