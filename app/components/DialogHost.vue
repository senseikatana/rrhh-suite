<script setup lang="ts">
/**
 * Renderiza el modal de confirmación/prompt global.
 * Un único host en el layout atiende todas las llamadas de `useDialogs()`.
 */
const { state, accept, cancel } = useDialogs()

const canConfirm = computed(() => {
  if (state.value.kind === 'prompt' && state.value.required) {
    return state.value.value.trim().length > 0
  }
  return true
})
</script>

<template>
  <UModal
    v-model:open="state.open"
    :title="state.title"
    :description="state.description || undefined"
    :dismissible="false"
    :ui="{ content: 'sm:max-w-md' }"
  >
    <template #body>
      <!-- Prompt: campo de texto -->
      <div v-if="state.kind === 'prompt'" class="flex flex-col gap-2">
        <label v-if="state.label" for="dialog-prompt-input" class="text-sm font-medium text-slate-700">
          {{ state.label }}
        </label>
        <textarea
          v-if="state.multiline"
          id="dialog-prompt-input"
          v-model="state.value"
          rows="3"
          class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          :placeholder="state.placeholder"
        />
        <input
          v-else
          id="dialog-prompt-input"
          v-model="state.value"
          type="text"
          class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          :placeholder="state.placeholder"
          @keyup.enter="canConfirm && accept()"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="soft" @click="cancel">
          {{ state.cancelLabel }}
        </UButton>
        <UButton
          :color="state.danger ? 'error' : 'primary'"
          :disabled="!canConfirm"
          @click="accept"
        >
          {{ state.confirmLabel }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
