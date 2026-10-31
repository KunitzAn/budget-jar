<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { ICON_GROUPS, searchIcons } from '../lib/icons'

/**
 * Название и иконка статьи. Одна и та же форма в настройках и прямо в
 * трате — чтобы заводить статью на ходу, не уходя из формы расхода.
 */
const name = defineModel<string>('name', { required: true })
const icon = defineModel<string>('icon', { required: true })

const query = ref('')
const list = ref<HTMLElement | null>(null)

const groups = computed(() => searchIcons(query.value))

const label = computed(
  () => ICON_GROUPS.flatMap((g) => g.icons).find((i) => i.name === icon.value)?.label ?? '',
)

/** Выбранная иконка может быть глубоко в списке — подкручиваем к ней. */
onMounted(async () => {
  await nextTick()
  list.value?.querySelector(`[data-icon="${icon.value}"]`)?.scrollIntoView({ block: 'center' })
})
</script>

<template>
  <label class="flex flex-col gap-1.5">
    <span class="text-xs text-muted">Название</span>
    <input v-model="name" type="text" placeholder="Кафе" class="field" />
  </label>

  <div class="flex flex-col gap-1.5">
    <div class="flex items-baseline justify-between">
      <span class="text-xs text-muted">Иконка</span>
      <span class="text-xs text-muted">{{ label }}</span>
    </div>
    <input v-model="query" type="search" placeholder="Поиск: кофе, такси, врач…" class="field" />

    <div ref="list" class="max-h-72 overflow-y-auto -mx-1 px-1 flex flex-col gap-3">
      <div v-for="group in groups" :key="group.title" class="flex flex-col gap-1.5">
        <span class="text-[11px] uppercase tracking-wide text-muted">{{ group.title }}</span>
        <div class="grid grid-cols-6 gap-2">
          <button
            v-for="item in group.icons"
            :key="item.name"
            type="button"
            :data-icon="item.name"
            :title="item.label"
            :aria-label="item.label"
            class="aspect-square rounded-xl grid place-items-center border transition-colors"
            :style="
              icon === item.name
                ? {
                    borderColor: 'var(--accent)',
                    background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
                    color: 'var(--accent)',
                  }
                : { borderColor: 'var(--line)', color: 'var(--muted)' }
            "
            @click="icon = item.name"
          >
            <component :is="item.icon" :size="18" />
          </button>
        </div>
      </div>
      <p v-if="groups.length === 0" class="py-3 text-sm text-muted">
        Ничего не нашлось — попробуйте другое слово.
      </p>
    </div>
  </div>
</template>
