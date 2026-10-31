<script setup lang="ts">
import { Check, Fingerprint, GripVertical, Plus, Trash2 } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import CategoryForm from '../components/CategoryForm.vue'
import SheetModal from '../components/SheetModal.vue'
import { alive, addCategory, removeCategory, updateCategory } from '../lib/data'
import { logout, me } from '../lib/auth'
import { db, type Category } from '../lib/db'
import { ICON_NAMES, iconComponent } from '../lib/icons'
import {
  listPasskeys,
  passkeyAvailable,
  PasskeyCancelled,
  registerPasskey,
  removePasskey,
  type PasskeyInfo,
} from '../lib/passkey'
import { pendingCount, runSync, syncing } from '../lib/sync'
import { useLiveQuery } from '../lib/useLiveQuery'

const categories = useLiveQuery(
  async () => (await db.categories.toArray()).filter((c) => !c.deletedAt).sort((a, b) => a.position - b.position),
  [],
)
const expenses = useLiveQuery(async () => alive(await db.expenses.toArray()), [])

/** Сколько трат ссылается на статью — показываем перед удалением. */
const usage = computed(() => {
  const map = new Map<string, number>()
  for (const e of expenses.value) map.set(e.categoryId, (map.get(e.categoryId) ?? 0) + 1)
  return map
})

const editing = ref<Category | null>(null)
const creating = ref(false)
const draftName = ref('')
const draftIcon = ref(ICON_NAMES[0]!)

function openNew() {
  draftName.value = ''
  draftIcon.value = ICON_NAMES[0]!
  creating.value = true
}

function openEdit(category: Category) {
  draftName.value = category.name
  draftIcon.value = category.icon
  editing.value = category
}

function closeSheet() {
  creating.value = false
  editing.value = null
}

async function saveCategory() {
  const name = draftName.value.trim()
  if (!name) return
  if (editing.value) await updateCategory(editing.value.id, { name, icon: draftIcon.value })
  else await addCategory(name, draftIcon.value)
  closeSheet()
}

async function handleRemoveCategory(category: Category) {
  const used = usage.value.get(category.id) ?? 0
  const warning = used > 0 ? ` У неё ${used} трат — они останутся, но без статьи.` : ''
  if (!confirm(`Удалить статью «${category.name}»?${warning}`)) return
  await removeCategory(category.id)
  closeSheet()
}

// Face ID
const canUsePasskey = ref(false)
const passkeys = ref<PasskeyInfo[]>([])
const passkeyBusy = ref(false)
const passkeyMessage = ref<string | null>(null)

async function reloadPasskeys() {
  try {
    passkeys.value = await listPasskeys()
  } catch {
    // офлайн — список просто не покажем, остальной экран работает
  }
}

onMounted(async () => {
  canUsePasskey.value = await passkeyAvailable()
  void reloadPasskeys()
})

async function addPasskey() {
  passkeyBusy.value = true
  passkeyMessage.value = null
  try {
    await registerPasskey()
    await reloadPasskeys()
    passkeyMessage.value = 'Готово — теперь можно входить по Face ID.'
  } catch (err) {
    if (err instanceof PasskeyCancelled) return
    passkeyMessage.value = 'Не получилось завести ключ. Попробуйте ещё раз.'
  } finally {
    passkeyBusy.value = false
  }
}

async function dropPasskey(id: string) {
  if (!confirm('Удалить этот ключ? Входить по Face ID на этом устройстве больше не получится.')) return
  await removePasskey(id)
  await reloadPasskeys()
}

async function handleLogout() {
  if (!confirm('Выйти? Данные останутся на сервере.')) return
  await logout()
}
</script>

<template>
  <main class="min-h-dvh pb-28">
    <div class="mx-auto max-w-md px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] flex flex-col gap-5">
      <h1 class="text-2xl font-bold text-ink">Настройки</h1>

      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between px-1">
          <h2 class="text-sm font-semibold text-muted">Статьи трат</h2>
          <button type="button" class="text-sm flex items-center gap-1" :style="{ color: 'var(--accent)' }" @click="openNew">
            <Plus :size="16" /> Добавить
          </button>
        </div>

        <div class="glass rounded-3xl divide-y" style="border-color: var(--line)">
          <button
            v-for="c in categories"
            :key="c.id"
            type="button"
            class="w-full flex items-center gap-3 px-4 py-3 text-left"
            @click="openEdit(c)"
          >
            <span
              class="shrink-0 w-9 h-9 rounded-xl grid place-items-center"
              :style="{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent)' }"
            >
              <component :is="iconComponent(c.icon)" :size="18" />
            </span>
            <span class="flex-1 text-sm text-ink truncate">{{ c.name }}</span>
            <span class="text-xs text-muted">{{ usage.get(c.id) ?? 0 }}</span>
            <GripVertical :size="16" class="text-muted opacity-50" />
          </button>
          <p v-if="categories.length === 0" class="px-4 py-4 text-sm text-muted">
            Пока нет ни одной статьи — добавьте первую.
          </p>
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-semibold text-muted px-1">Вход по Face ID</h2>
        <div class="glass rounded-3xl p-4 flex flex-col gap-3">
          <template v-if="canUsePasskey">
            <div v-for="k in passkeys" :key="k.id" class="flex items-center gap-2 text-sm">
              <Fingerprint :size="16" :style="{ color: 'var(--accent)' }" />
              <span class="text-ink">{{ k.label ?? 'Устройство' }}</span>
              <button
                type="button"
                class="ml-auto p-1"
                :style="{ color: 'var(--spend)' }"
                aria-label="Удалить ключ"
                @click="dropPasskey(k.id)"
              >
                <Trash2 :size="16" />
              </button>
            </div>
            <button
              type="button"
              :disabled="passkeyBusy"
              class="w-full rounded-2xl py-2.5 text-sm font-medium border disabled:opacity-40"
              :style="{ borderColor: 'var(--line)', color: 'var(--accent)' }"
              @click="addPasskey"
            >
              {{ passkeyBusy ? 'Подождите…' : 'Завести ключ на этом устройстве' }}
            </button>
            <p v-if="passkeyMessage" class="text-xs text-muted">{{ passkeyMessage }}</p>
          </template>
          <p v-else class="text-sm text-muted">На этом устройстве нет Face ID или Touch ID.</p>
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-semibold text-muted px-1">Синхронизация</h2>
        <div class="glass rounded-3xl p-4 flex flex-col gap-2 text-sm">
          <div class="flex items-center gap-2">
            <Check v-if="pendingCount === 0 && !syncing" :size="16" :style="{ color: 'var(--vnd)' }" />
            <span class="text-ink">
              <template v-if="syncing">Синхронизирую…</template>
              <template v-else-if="pendingCount > 0">Ждут отправки: {{ pendingCount }}</template>
              <template v-else>Всё отправлено</template>
            </span>
            <button type="button" class="ml-auto text-xs" :style="{ color: 'var(--accent)' }" @click="runSync()">
              Обновить
            </button>
          </div>
          <p class="text-xs text-muted">
            Траты можно вносить без интернета — они сохраняются на телефоне и уходят на сервер,
            когда связь появится.
          </p>
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <div class="glass rounded-3xl p-4 flex flex-col gap-3 text-sm">
          <span class="text-muted">Вход выполнен: {{ me?.email ?? '—' }}</span>
          <button
            type="button"
            class="w-full rounded-2xl py-2.5 font-medium border"
            :style="{ borderColor: 'var(--line)', color: 'var(--spend)' }"
            @click="handleLogout"
          >
            Выйти
          </button>
        </div>
      </section>
    </div>

    <SheetModal v-if="creating || editing" :title="editing ? 'Статья' : 'Новая статья'" @close="closeSheet">
      <CategoryForm v-model:name="draftName" v-model:icon="draftIcon" />

      <button
        type="button"
        :disabled="!draftName.trim()"
        class="w-full rounded-2xl py-3 text-white font-medium bg-accent disabled:opacity-40"
        @click="saveCategory"
      >
        Сохранить
      </button>

      <button
        v-if="editing"
        type="button"
        class="w-full rounded-2xl py-2.5 text-sm font-medium border"
        :style="{ borderColor: 'var(--line)', color: 'var(--spend)' }"
        @click="handleRemoveCategory(editing)"
      >
        Удалить статью
      </button>
    </SheetModal>
  </main>
</template>
