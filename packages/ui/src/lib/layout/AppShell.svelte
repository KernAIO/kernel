<script lang="ts">
import type { Snippet } from 'svelte'
import { cn } from '../utils.js'

/**
 * 100dvh grid: 60px rail · 268px sidebar · content (DESIGN.md §2.1).
 * ≤1024px: sidebar becomes a drawer (bind:sidebarOpen). ≤768px: rail hidden, bottom tab bar shown.
 * Overlays that belong to the content column (inline Sheet/Command/Toaster) are positioned inside `.kshell-content`.
 */
interface Props {
  rail?: Snippet
  sidebar?: Snippet
  bottomBar?: Snippet
  children: Snippet
  sidebarOpen?: boolean
  hideSidebar?: boolean
  class?: string
}
let {
  rail,
  sidebar,
  bottomBar,
  children,
  sidebarOpen = $bindable(false),
  hideSidebar = false,
  class: className,
}: Props = $props()
</script>

<div class={cn('kshell', hideSidebar && 'no-sidebar', sidebarOpen && 'drawer-open', className)}>
  {#if rail}<aside class="kshell-rail" aria-label="Modules">{@render rail()}</aside>{/if}
  {#if sidebar && !hideSidebar}
    <aside class="kshell-sidebar" aria-label="Navigation">{@render sidebar()}</aside>
    <button type="button" class="kshell-scrim" aria-label="Close navigation" tabindex="-1" onclick={() => (sidebarOpen = false)}></button>
  {/if}
  <main class="kshell-content" id="main">{@render children()}</main>
  {#if bottomBar}<nav class="kshell-bottom" aria-label="Primary">{@render bottomBar()}</nav>{/if}
</div>

<style>
  .kshell {
    height: 100dvh; display: grid; grid-template-columns: var(--kern-rail-w) var(--kern-sidebar-w) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr);
    overflow: hidden; background: var(--kern-shell); color: var(--kern-ink-700); font-family: var(--kern-font-sans); -webkit-font-smoothing: antialiased;
  }
  .kshell.no-sidebar { grid-template-columns: var(--kern-rail-w) minmax(0, 1fr); }
  .kshell-rail { min-height: 0; border-inline-end: 1px solid var(--kern-border); display: flex; flex-direction: column; align-items: center; padding: 12px 0 14px; overflow: hidden; background: var(--kern-shell); }
  .kshell-sidebar { min-height: 0; border-inline-end: 1px solid var(--kern-border); display: flex; flex-direction: column; overflow: hidden; background: var(--kern-shell); }
  .kshell-scrim { display: none; }
  .kshell-content { position: relative; display: flex; flex-direction: column; overflow: hidden; background: var(--kern-surface); min-width: 0; min-height: 0; }
  .kshell-bottom { display: none; }

  @media (max-width: 1024px) {
    .kshell { grid-template-columns: var(--kern-rail-w) minmax(0, 1fr); }
    .kshell-sidebar { position: fixed; top: 0; bottom: 0; inset-inline-start: var(--kern-rail-w); width: var(--kern-sidebar-w); z-index: 45; transform: translateX(-100%); transition: transform 160ms var(--kern-ease-out); box-shadow: none; }
    :global([dir='rtl']) .kshell-sidebar { transform: translateX(100%); }
    .drawer-open .kshell-sidebar { transform: translateX(0) !important; box-shadow: var(--kern-shadow-popover); }
    .drawer-open .kshell-scrim { display: block; position: fixed; inset: 0; z-index: 44; background: var(--kern-overlay); border: 0; animation: kfade 0.1s; }
  }
  @media (max-width: 768px) {
    .kshell { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; }
    .kshell-rail { display: none; }
    .kshell-sidebar { inset-inline-start: 0; width: min(var(--kern-sidebar-w), 86vw); }
    .kshell-bottom { display: flex; align-items: stretch; justify-content: space-around; height: calc(var(--kern-bottombar-h) + env(safe-area-inset-bottom)); padding-bottom: env(safe-area-inset-bottom); border-top: 1px solid var(--kern-border); background: var(--kern-shell); }
  }
</style>
