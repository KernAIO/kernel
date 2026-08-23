/**
 * Client-side module SDK (framework-agnostic types). `@kernhq/ui` re-exports these bound to Svelte components.
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
  /**
   * Where the shell mounts the page: workspace settings, the signed-in user's own settings, or the
   * instance console. `instance` pages are additionally gated on the instance-admin flag by the
   * console's layout — a module cannot grant itself an audience by declaring one.
   */
  scope: 'workspace' | 'user' | 'instance'
  permission?: string
  component: () => Promise<{ default: C }>
  order?: number
}

/** Step sizes a widget may be given. Nobody picks pixels. */
export type WidgetSize = 's' | 'm' | 'l' | 'xl'

/** Per-instance settings. JSON-safe, because they round-trip through a jsonb column. */
export type WidgetSettings = Record<string, string | number | boolean | null>

export interface WidgetOption {
  value: string
  label: string
  icon?: string
}

export interface WidgetSettingsContext {
  workspaceId: string
  workspaceSlug: string
  userId: string | null
}

/**
 * One setting on one placed widget, which the shell renders as a form control.
 *
 * Declarative on purpose: a widget that draws its own settings dialog is a widget whose settings
 * look different from every other widget's, and the shell can no longer tell what a stored value
 * means when the widget that wrote it is gone.
 */
export type WidgetSettingField =
  | {
      kind: 'select'
      key: string
      label: string
      default: string | null
      /** static choices… */
      options?: WidgetOption[]
      /** …or choices fetched from the module's own API when the form opens */
      loadOptions?: (ctx: WidgetSettingsContext) => Promise<WidgetOption[]>
      /** offer an "any" choice that maps to null */
      nullable?: boolean
      nullLabel?: string
    }
  | { kind: 'number'; key: string; label: string; default: number; min: number; max: number; step?: number }
  | { kind: 'toggle'; key: string; label: string; default: boolean }
  | { kind: 'text'; key: string; label: string; default: string; placeholder?: string; maxLength?: number }

/**
 * A card a module offers on the workspace dashboard.
 *
 * This is a catalogue entry, not a slot: the shell has to draw it in a picker, validate a saved
 * layout against its sizes, and generate a settings form — none of which a `SlotContribution` says
 * enough to do.
 *
 * `title` and `description` should be declared as getters (`get title() { return m.x() }`), like
 * `ClientNavItem.label`: a module is defined once at import time, and the interface language can
 * change afterwards.
 */
export interface WidgetDefinition<C = unknown> {
  /** `<module>.<widget>`. Stored in every saved layout, so renaming one orphans it. */
  id: string
  title: string
  description?: string
  icon?: string
  /** absent from the picker, and skipped in a stored layout, for anyone without it */
  permission?: string
  /** the sizes this widget can be given, smallest first; must not be empty */
  sizes: WidgetSize[]
  defaultSize: WidgetSize
  /**
   * Draw without the frame's header while somebody is reading the board.
   *
   * A stat tile is one number under its own label, so a header above it would say the same word
   * twice and eat the height the number needs. The header comes back in edit mode, because that is
   * where the drag handle and the menu live.
   */
  compact?: boolean
  settings?: WidgetSettingField[]
  component: () => Promise<{ default: C }>
  /** reasons a permission cannot express — the workspace has no projects yet */
  when?: (ctx: ClientContext) => boolean
  /** order within this module's group in the picker */
  order?: number
}

/**
 * What the shell hands a widget's body. The frame — card, header, drag grip, menu, loading and
 * error states — belongs to the shell, which is why there is no `title` here.
 */
export interface WidgetProps {
  /** the placed instance, unique within one layout; scope query keys with it */
  instanceId: string
  workspaceId: string
  workspaceSlug: string
  /** declared defaults merged with what was saved, minus keys the definition no longer declares */
  settings: WidgetSettings
  size: WidgetSize
  /** placed geometry in grid units, for a widget that decides how many rows to draw */
  span: { w: number; h: number }
  /** true while the grid is being rearranged: keep the data, drop the row actions */
  editing: boolean
  /** 12 on a desktop, 6 on a tablet, 1 on a phone */
  columns: 12 | 6 | 1
  /** open this instance's settings — a widget's own empty state can offer it */
  configure: () => void
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
  /** Cards this module offers on the workspace dashboard. */
  widgets?: WidgetDefinition<C>[]
  /** i18n message bundles by locale, merged into the app's */
  messages?: Record<string, () => Promise<Record<string, string>>>
  onActivate?: (ctx: ClientContext) => void | Promise<void>
}
export function defineClientModule<C = unknown>(mod: ClientModule<C>): ClientModule<C> {
  return mod
}
