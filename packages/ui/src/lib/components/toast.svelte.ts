/** Toast store (sonner-style API, Kern look). Import `toast` anywhere; render <Toaster/> once. */
export type ToastKind = 'info' | 'success' | 'error' | 'warning'
export interface ToastOptions {
  description?: string
  kind?: ToastKind
  duration?: number
  action?: { label: string; onClick: () => void }
  id?: string
}
export interface ToastItem extends Required<Pick<ToastOptions, 'id' | 'kind' | 'duration'>> {
  title: string
  description?: string
  action?: ToastOptions['action']
  createdAt: number
}

class ToastStore {
  items = $state<ToastItem[]>([])
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  show(title: string, opts: ToastOptions = {}) {
    const id = opts.id ?? `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`
    const item: ToastItem = {
      id,
      title,
      description: opts.description,
      kind: opts.kind ?? 'info',
      duration: opts.duration ?? 2200,
      action: opts.action,
      createdAt: Date.now(),
    }
    this.items = [...this.items.filter((t) => t.id !== id), item].slice(-4)
    this.schedule(item)
    return id
  }
  private schedule(item: ToastItem) {
    const prev = this.timers.get(item.id)
    if (prev) clearTimeout(prev)
    if (item.duration > 0)
      this.timers.set(
        item.id,
        setTimeout(() => this.dismiss(item.id), item.duration),
      )
  }
  pause(id: string) {
    const t = this.timers.get(id)
    if (t) {
      clearTimeout(t)
      this.timers.delete(id)
    }
  }
  resume(id: string) {
    const it = this.items.find((t) => t.id === id)
    if (it) this.schedule({ ...it, duration: 1200 })
  }
  dismiss(id: string) {
    this.items = this.items.filter((t) => t.id !== id)
    const t = this.timers.get(id)
    if (t) clearTimeout(t)
    this.timers.delete(id)
  }
  clear() {
    for (const t of this.items) this.dismiss(t.id)
  }
  success = (title: string, o: ToastOptions = {}) => this.show(title, { ...o, kind: 'success' })
  error = (title: string, o: ToastOptions = {}) =>
    this.show(title, { ...o, kind: 'error', duration: o.duration ?? 4000 })
  info = (title: string, o: ToastOptions = {}) => this.show(title, { ...o, kind: 'info' })
  warning = (title: string, o: ToastOptions = {}) => this.show(title, { ...o, kind: 'warning' })
}
export const toastStore = new ToastStore()
export const toast = Object.assign((title: string, opts?: ToastOptions) => toastStore.show(title, opts), {
  success: toastStore.success,
  error: toastStore.error,
  info: toastStore.info,
  warning: toastStore.warning,
  dismiss: (id: string) => toastStore.dismiss(id),
  clear: () => toastStore.clear(),
})
