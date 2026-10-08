<template>
  <div v-if="categories.length > 0" class="category-toggles">
    <span class="toggles-label">{{ label }}</span>
    <div class="chips">
      <button
        v-for="c in categories"
        :key="c.id"
        type="button"
        class="chip"
        :class="{ off: !c[flag] }"
        :style="c[flag] ? { background: c.color } : undefined"
        :disabled="!isOnline || savingId === c.id"
        :aria-pressed="c[flag]"
        @click="toggle(c)"
      >
        {{ c.name }}
      </button>
    </div>
    <p v-if="message" class="toggles-message">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { updateCategory } from '../api/categories'
import { useOnlineStatus } from '../composables/useOnlineStatus'
import type { CategoryFlag } from '../lib/categories'
import type { Category } from '../types'

const props = defineProps<{
  categories: Category[]
  flag: CategoryFlag
  label: string
}>()

const emit = defineEmits<{ updated: [category: Category] }>()

const { isOnline } = useOnlineStatus()
const savingId = ref<number | null>(null)
const message = ref('')

const toggle = async (category: Category) => {
  if (!isOnline.value) {
    message.value = 'Нужно подключение к интернету, чтобы изменить настройку'
    return
  }

  message.value = ''
  savingId.value = category.id
  try {
    const { data } = await updateCategory(category.id, { [props.flag]: !category[props.flag] })
    emit('updated', data)
  } catch (err: any) {
    message.value = !err.response
      ? 'Нужно подключение к интернету, чтобы изменить настройку'
      : 'Не удалось сохранить настройку'
  } finally {
    savingId.value = null
  }
}
</script>

<style scoped>
.category-toggles {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
  text-align: center;
}

.toggles-label {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.chip {
  padding: 0.3125rem 0.875rem;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
  cursor: pointer;
  transition: opacity 0.2s, transform 0.15s;
}

.chip:hover:not(:disabled) {
  transform: translateY(-1px);
}

/* выключенная категория — бледная и без заливки, видно, что она не в счёте */
.chip.off {
  background: transparent;
  border-color: var(--card-border);
  color: var(--text-secondary);
  font-weight: 500;
  text-shadow: none;
  text-decoration: line-through;
}

.chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggles-message {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--danger);
}
</style>
