// @kernalo/ui — Kern "Ink / paper" design system (Svelte 5).
// Styles are shipped separately: import '@kernalo/ui/styles/index.css' (or fonts/tokens/theme individually).

// ---- primitives ----
export { default as Avatar } from './components/Avatar.svelte'
export { default as AvatarStack } from './components/AvatarStack.svelte'
export { type BadgeTone, type BadgeVariant, default as Badge } from './components/Badge.svelte'
export { default as Breadcrumb } from './components/Breadcrumb.svelte'
export { type ButtonSize, type ButtonVariant, default as Button } from './components/Button.svelte'
export { default as Card } from './components/Card.svelte'
export { default as Checkbox } from './components/Checkbox.svelte'
export { type CommandItem, default as Command } from './components/Command.svelte'
export { default as ContextMenu } from './components/ContextMenu.svelte'
export { default as Dialog } from './components/Dialog.svelte'
export { default as DropdownMenu } from './components/DropdownMenu.svelte'
export { default as EmptyState } from './components/EmptyState.svelte'
export { default as Field } from './components/Field.svelte'
export { default as IconButton } from './components/IconButton.svelte'
export { default as Input } from './components/Input.svelte'
export { default as Kbd } from './components/Kbd.svelte'
export { default as Label } from './components/Label.svelte'
export { default as ListRow } from './components/ListRow.svelte'
export type { MenuItem } from './components/menu-types.js'
export { default as Popover } from './components/Popover.svelte'
export { default as ProgressBar } from './components/ProgressBar.svelte'
export { default as ScrollArea } from './components/ScrollArea.svelte'
export { default as SearchBox } from './components/SearchBox.svelte'
export { default as SectionLabel } from './components/SectionLabel.svelte'
export { default as SegmentedControl, type SegmentItem } from './components/SegmentedControl.svelte'
export { default as Select, type SelectOption } from './components/Select.svelte'
export { default as Separator } from './components/Separator.svelte'
export { default as Sheet } from './components/Sheet.svelte'
export { default as Skeleton } from './components/Skeleton.svelte'
export { default as Spinner } from './components/Spinner.svelte'
export { default as StatTile } from './components/StatTile.svelte'
export { default as StatusDot } from './components/StatusDot.svelte'
export { default as Switch } from './components/Switch.svelte'
export { default as Table } from './components/Table.svelte'
export { default as TableCell } from './components/TableCell.svelte'
export { default as TableHeader } from './components/TableHeader.svelte'
export { default as TableRow } from './components/TableRow.svelte'
export { default as Tabs, type TabItem } from './components/Tabs.svelte'
export { default as Textarea } from './components/Textarea.svelte'
export { default as Toaster } from './components/Toaster.svelte'
export { default as Tooltip } from './components/Tooltip.svelte'
export { default as TooltipProvider } from './components/TooltipProvider.svelte'
export {
  type ToastItem,
  type ToastKind,
  type ToastOptions,
  toast,
  toastStore,
} from './components/toast.svelte.js'
// ---- icons ----
export { default as Icon } from './icons/Icon.svelte'
export { getIcon, iconNames, registerIcons } from './icons/registry.js'
// ---- app-shell layout ----
export { default as AppShell } from './layout/AppShell.svelte'
export { default as BottomTabItem } from './layout/BottomTabItem.svelte'
export { default as Page } from './layout/Page.svelte'
export { default as PageHeader } from './layout/PageHeader.svelte'
export { default as Rail } from './layout/Rail.svelte'
export { default as RailItem } from './layout/RailItem.svelte'
export { default as RailLogo } from './layout/RailLogo.svelte'
export { default as RightPanel } from './layout/RightPanel.svelte'
export { default as Sidebar } from './layout/Sidebar.svelte'
export { default as SidebarGroup } from './layout/SidebarGroup.svelte'
export { default as SidebarItem } from './layout/SidebarItem.svelte'
export { default as SidebarPill } from './layout/SidebarPill.svelte'
export { default as SidebarSwitcher } from './layout/SidebarSwitcher.svelte'
export { default as Toolbar } from './layout/Toolbar.svelte'
export { default as ToolbarButton } from './layout/ToolbarButton.svelte'
export { default as ViewToggle } from './layout/ViewToggle.svelte'
// ---- client-module SDK (Svelte-typed) ----
export {
  type AnyComponent,
  type ClientContext,
  type ClientNavItem,
  type CommandAction,
  defineClientModule,
  type KeyboardShortcut,
  type SlotName,
  type SvelteClientModule,
  type SvelteClientRoute,
  type SvelteClientSettingsPage,
  type SvelteNotificationRenderer,
  type SvelteObjectPresenter,
  type SvelteSlotContribution,
} from './module.js'
// ---- utilities ----
export {
  avatarFontSize,
  avatarRadius,
  cn,
  formatKeys,
  IDENTITY_COLORS,
  identityColor,
  initials,
  isMac,
  timeAgo,
  uid,
} from './utils.js'
