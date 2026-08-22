# @kernaio/ui

Kern's design system — the "Ink / paper" look: warm paper surfaces, near-black ink text tiers, a single burnt-orange accent, hairline borders instead of shadows, `Instrument Sans` for UI and `DM Mono` for metadata. Built with Svelte 5 (runes) on top of [Bits UI](https://bits-ui.com) headless primitives.

The visual spec lives in [`app/DESIGN.md`](https://github.com/KernAIO/app/blob/main/DESIGN.md); every color, radius and size here comes from it.

## Install

```bash
pnpm add @kernaio/ui
```

`svelte >= 5.46` is a peer dependency. The styles ship as plain CSS:

```ts
// app entry css (Tailwind v4)
import 'tailwindcss'
import '@kernaio/ui/styles/index.css' // fonts + tokens (+ utilities)
import '@kernaio/ui/styles/theme.css' // shadcn-style vars + Tailwind @theme mapping
```

- `styles/fonts.css` — Google-Fonts import for Instrument Sans, DM Mono and Vazirmatn (fa/ar).
- `styles/tokens.css` — every `--kern-*` token, light + dark (`[data-theme='dark']`), scrollbars, `kslide`/`kfade` keyframes, helper classes (`.kern-section-label`, `.kern-hairline`, …).
- `styles/theme.css` — maps tokens to shadcn variables (`--background`, `--primary`, …) and exposes them to Tailwind v4 via `@theme inline` (`bg-kern-surface-hover`, `text-kern-ink-350`, `rounded-card`, …).

## Usage

```svelte
<script>
  import { AppShell, Button, Command, Toaster, toast } from '@kernaio/ui'
</script>

<Button icon="plus" size="lg" rounded="xl">New issue</Button>
<Button variant="secondary" onclick={() => toast.success('Saved')}>Save</Button>
<Toaster />
```

### What's inside

- **Primitives** — `Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Badge` (chip / count / glow), `Avatar` + `AvatarStack` (deterministic identity colors), `Tabs` (underline + pill), `SegmentedControl`, `Dialog`, `Sheet` (440px detail panel), `Popover`, `DropdownMenu`, `ContextMenu`, `Tooltip`, `Command` (⌘K palette), `toast`/`Toaster`, `Kbd`, `Skeleton`, `EmptyState`, `Separator`, `ScrollArea`, table primitives, `ListRow`, `StatTile`, `SectionLabel`, `SearchBox`, `Breadcrumb`, `StatusDot`, `ProgressBar`, `Spinner`, `Card`, `Field`.
- **Layout** — `AppShell` (60px rail · 268px sidebar · content grid, responsive: drawer ≤1024px, bottom tabs ≤768px), `Rail`/`RailItem`/`RailLogo`, `Sidebar`/`SidebarSwitcher`/`SidebarGroup`/`SidebarItem`/`SidebarPill`, `PageHeader`, `Toolbar`/`ToolbarButton`/`ViewToggle`, `RightPanel`, `Page`, `BottomTabItem`.
- **Icons** — `Icon` name-based wrapper over a curated Lucide registry (`registerIcons` to extend).
- **Module SDK** — `defineClientModule` re-exported from `@kernaio/kernel/client` with contribution points typed as Svelte components.

### RTL & dark mode

Everything uses CSS logical properties and flips correctly under `dir="rtl"` (fa/ar); Vazirmatn is in the font stacks. Dark mode is activated by setting `data-theme="dark"` (or class `dark`) on `<html>`.

## Development

```bash
pnpm build      # svelte-package → dist + publint
pnpm typecheck  # svelte-check
pnpm test
```

Licensed under AGPL-3.0-only, like the rest of Kern.
