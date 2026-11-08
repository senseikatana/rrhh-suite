import type { Ref } from 'vue'

/**
 * Diálogos de confirmación y prompt sobre Nuxt UI (`UModal`).
 *
 * Reemplazan `window.confirm` / `window.prompt` por modales reales con API de
 * promesas, para que las acciones se disparen desde botones dinámicos sin
 * bloquear el hilo de render. Un solo `DialogHost` (montado en el layout) pinta
 * el modal según el estado global, y cada llamada resuelve una promesa.
 */

export interface ConfirmDialogOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Botón de confirmación en tono destructivo. */
  danger?: boolean
}

export interface PromptDialogOptions extends ConfirmDialogOptions {
  label?: string
  placeholder?: string
  multiline?: boolean
  /** El valor no puede ser una cadena vacía para confirmar. */
  required?: boolean
}

interface DialogState {
  open: boolean
  kind: 'confirm' | 'prompt'
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  danger: boolean
  // Solo para kind === 'prompt'
  label: string
  placeholder: string
  multiline: boolean
  required: boolean
  value: string
}

// Cola de resolvers: si se abre un diálogo mientras otro está pendiente, el
// anterior se resuelve en su valor por defecto en vez de quedar colgado (una
// promesa que nunca se resuelve congela el flujo y retiene la closure).
let confirmResolver: ((value: boolean) => void) | null = null
let promptResolver: ((value: string | null) => void) | null = null

function initialState(): DialogState {
  return {
    open: false,
    kind: 'confirm',
    title: '',
    description: '',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    danger: false,
    label: '',
    placeholder: '',
    multiline: false,
    required: false,
    value: '',
  }
}

function openDialog(partial: Partial<DialogState>) {
  // Resolver cualquier diálogo pendiente antes de reemplazarlo.
  confirmResolver?.(false)
  confirmResolver = null
  promptResolver?.(null)
  promptResolver = null

  getState().value = { ...initialState(), open: true, ...partial }
}

function closeDialog() {
  getState().value.open = false
}

// El estado vive dentro del composable (useState por instancia de request), no
// a scope de módulo: en SSR un useState de módulo se comparte entre requests.
function getState(): Ref<DialogState> {
  return useState<DialogState>('dialog-state', initialState)
}

/** Pide confirmación. Resuelve `true` si el usuario acepta. */
function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    confirmResolver = resolve
    openDialog({
      kind: 'confirm',
      title: options.title,
      description: options.description ?? '',
      confirmLabel: options.confirmLabel ?? 'Confirmar',
      cancelLabel: options.cancelLabel ?? 'Cancelar',
      danger: options.danger ?? false,
    })
  })
}

/** Pide un texto. Resuelve el valor, o `null` si se cancela. */
function promptDialog(options: PromptDialogOptions): Promise<string | null> {
  return new Promise((resolve) => {
    promptResolver = resolve
    openDialog({
      kind: 'prompt',
      title: options.title,
      description: options.description ?? '',
      confirmLabel: options.confirmLabel ?? 'Aceptar',
      cancelLabel: options.cancelLabel ?? 'Cancelar',
      danger: options.danger ?? false,
      label: options.label ?? '',
      placeholder: options.placeholder ?? '',
      multiline: options.multiline ?? false,
      required: options.required ?? false,
      value: '',
    })
  })
}

function accept() {
  const state = getState()
  if (state.value.kind === 'confirm') {
    confirmResolver?.(true)
    confirmResolver = null
  } else {
    promptResolver?.(state.value.value)
    promptResolver = null
  }
  closeDialog()
}

function cancel() {
  if (getState().value.kind === 'confirm') {
    confirmResolver?.(false)
    confirmResolver = null
  } else {
    promptResolver?.(null)
    promptResolver = null
  }
  closeDialog()
}

export function useDialogs() {
  return {
    state: getState(),
    confirm: confirmDialog,
    prompt: promptDialog,
    accept,
    cancel,
  }
}
