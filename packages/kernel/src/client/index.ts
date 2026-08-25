/**
 * Client-side module SDK (framework-agnostic types). `@kernhq/ui` re-exports these bound to Svelte components.
 * A client module contributes routes, navigation, command-palette actions, presenters and slots to the app shell.
 *
 * Most contributions carry two optional gates, and they answer different questions:
 *
 * - `permission` — may *this person* reach it. Someone else in the same workspace may well see it.
 * - `capability` — does *this workspace* have the feature at all, named as this module's own
 *   capability id (`'attendance'`, not `'hr.attendance'`). Nobody sees it when it is off, and the
 *   API behind it answers 404 rather than 403, so the two halves agree.
 *
 * Both are filters, never a disabled state: a contribution that cannot be used is not rendered.
 * A greyed-out row that explains it needs an upgrade is a product decision for the shell to make in
 * one place, not something two dozen modules each invent.
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
  /** this module's capability id; the row is absent when the workspace has it off */
  capability?: string
}
export interface ClientRoute<C = unknown> {
  path: string
  component: () => Promise<{ default: C }>
  title?: string
  permission?: string
  /** this module's capability id; the route is not mounted when the workspace has it off */
  capability?: string
}
export interface CommandAction {
  id: string
  label: string
  icon?: string
  shortcut?: string[]
  group?: string
  permission?: string
  /** this module's capability id; absent from the palette when the workspace has it off */
  capability?: string
  run: (ctx: ClientContext) => void | Promise<void>
  when?: (ctx: ClientContext) => boolean
}
export interface ObjectPresenter<C = unknown> {
  type: string
  inline: () => Promise<{ default: C }>
  card?: () => Promise<{ default: C }>
  page?: (id: string, workspaceSlug: string) => string
}
/**
 * A sidebar a module owns.
 *
 * The rail switches modules and the sidebar holds the one you are in, so the module in view fills
 * the whole column — its own control strip and its own navigation — rather than reaching into a
 * shell that happens to leave a gap. `match` names the first path segment after `/<workspace>`;
 * `''` is the home sidebar, which several modules may contribute a group to at once.
 *
 * Matching a *segment* rather than a substring is deliberate: gating on `pathname.includes('/chat')`
 * also matches a workspace whose slug is `chat`, which is how the previous version of this got it
 * wrong.
 */
export interface SidebarContribution<C = unknown> {
  id: string
  /** first path segments after `/<workspace>` this fills; `''` is the home sidebar */
  match: string[]
  order?: number
  /**
   * Fills the control strip, replacing the shell's ⌘K box.
   *
   * A module that owns the sidebar owns the row above it too — the tracker puts "New issue" there,
   * chat puts its channel search — so the shell steps aside rather than stacking its own box above
   * the module's.
   */
  controls?: () => Promise<{ default: C }>
  component: () => Promise<{ default: C }>
  permission?: string
  /** this module's capability id; the sidebar is not filled when the workspace has it off */
  capability?: string
}

/** What the shell hands a sidebar contribution. */
export interface SidebarProps {
  workspaceId: string
  workspaceSlug: string
  pathname: string
  /** the segment that matched, so one contribution can serve several */
  segment: string
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
  /** this module's capability id; the page is not offered when the workspace has it off */
  capability?: string
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
 * layout against its sizes, and generate a settings form — none of which an untyped slot says
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
  /**
   * This module's capability id. A widget behind a capability the workspace has switched off leaves
   * the picker *and* any layout that already placed it — same treatment as a permission, and the
   * reason the dashboard needs no conditional of its own.
   */
  capability?: string
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

/**
 * One translated message: a plain string, or a counted one keyed by CLDR plural category.
 *
 * A counted message is not a string with `{count}` in it. English has two forms and Arabic has six,
 * and which applies is `Intl.PluralRules`' answer rather than the author's — `{n} days` with a
 * number substituted is how a Persian screen ends up reading "۱ روزها".
 */
export type Message = string | Partial<Record<Intl.LDMLPluralRule, string>>

export interface ClientContext {
  workspaceId: string | null
  workspaceSlug: string | null
  userId: string | null
  permissions: Set<string>
  /**
   * Capabilities on in this workspace, as `<moduleId>.<capabilityId>` — namespaced here because the
   * context spans every module, while a contribution's own `capability` field is not.
   */
  capabilities: Set<string>
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
  sidebar?: SidebarContribution<C>[]
  shortcuts?: KeyboardShortcut[]
  notifications?: NotificationRenderer<C>[]
  settingsPages?: ClientSettingsPage<C>[]
  /** Cards this module offers on the workspace dashboard. */
  widgets?: WidgetDefinition<C>[]
  /** i18n message bundles by locale, merged into the app's */
  messages?: Record<string, () => Promise<Record<string, Message>>>
  onActivate?: (ctx: ClientContext) => void | Promise<void>
}
export function defineClientModule<C = unknown>(mod: ClientModule<C>): ClientModule<C> {
  return mod
}
