/**
 * Client-side module SDK (framework-agnostic types). `@kernalo/ui` re-exports these bound to Svelte components.
 * A client module contributes routes, navigation, command-palette actions, presenters and slots to the app shell.
 */
export interface ClientNavItem {
  id: string
  label: string
  icon?: string
  href: string
  badgeKey?: string
  order?: number
  section?: 'primary' | 'secondary'
  permission?: string
}
export interface ClientRoute<C = unknown> {
  path: string
  component: () => Promise<{ default: C }>
  title?: string
  permission?: string
}
export interface CommandAction {
  id: string
  label: string
  icon?: string
  shortcut?: string[]
  group?: string
  permission?: string
  run: (ctx: ClientContext) => void | Promise<void>
  when?: (ctx: ClientContext) => boolean
}
export interface ObjectPresenter<C = unknown> {
  type: string
  inline: () => Promise<{ default: C }>
  card?: () => Promise<{ default: C }>
  page?: (id: string, workspaceSlug: string) => string
}
export type SlotName =
  | 'sidebar.footer'
  | 'sidebar.widget'
  | 'header.actions'
  | 'object.panel.tab'
  | 'settings.workspace'
  | 'settings.user'
  | 'notification.item'
  | 'chat.message.action'
  | 'chat.composer.action'
  | 'dashboard.widget'
  | 'cmdk.section'
export interface SlotContribution<C = unknown> {
  slot: SlotName
  id: string
  order?: number
  component: () => Promise<{ default: C }>
  when?: (ctx: ClientContext) => boolean
  props?: Record<string, unknown>
}
export interface KeyboardShortcut {
  id: string
  keys: string[]
  label: string
  scope?: 'global' | string
  run: (ctx: ClientContext) => void
}
export interface NotificationRenderer<C = unknown> {
  types: string[]
  component: () => Promise<{ default: C }>
}
export interface ClientSettingsPage<C = unknown> {
  id: string
  label: string
  icon?: string
  scope: 'workspace' | 'user'
  permission?: string
  component: () => Promise<{ default: C }>
  order?: number
}

export interface ClientContext {
  workspaceId: string | null
  workspaceSlug: string | null
  userId: string | null
  permissions: Set<string>
  navigate: (href: string) => void
  openPalette: (query?: string) => void
  toast: (msg: { title: string; description?: string; kind?: 'info' | 'success' | 'error' }) => void
  api: unknown
}

export interface ClientModule<C = unknown> {
  id: string
  name: string
  icon?: string
  nav?: ClientNavItem[]
  routes?: ClientRoute<C>[]
  commands?: CommandAction[]
  presenters?: ObjectPresenter<C>[]
  slots?: SlotContribution<C>[]
  shortcuts?: KeyboardShortcut[]
  notifications?: NotificationRenderer<C>[]
  settingsPages?: ClientSettingsPage<C>[]
  /** i18n message bundles by locale, merged into the app's */
  messages?: Record<string, () => Promise<Record<string, string>>>
  onActivate?: (ctx: ClientContext) => void | Promise<void>
}
export function defineClientModule<C = unknown>(mod: ClientModule<C>): ClientModule<C> {
  return mod
}
