/**
 * Client-module surface of `@kernhq/kernel/client`, re-exported with the
 * component type bound to Svelte's `Component`. Modules written for the Kern
 * app should import `defineClientModule` from here so their `routes`,
 * `presenters` and `slots` are type-checked as Svelte components.
 */

import {
  type ClientContext,
  type ClientModule,
  type ClientNavItem,
  type ClientRoute,
  type ClientSettingsPage,
  type CommandAction,
  defineClientModule as defineUntyped,
  type KeyboardShortcut,
  type NotificationRenderer,
  type ObjectPresenter,
  type OverlayContribution,
  type OverlayProps,
  type SidebarContribution,
  type SidebarProps,
  type WidgetDefinition,
  type WidgetOption,
  type WidgetProps,
  type WidgetSettingField,
  type WidgetSettings,
  type WidgetSettingsContext,
  type WidgetSize,
} from '@kernhq/kernel/client'
import type { Component } from 'svelte'

/** Any Svelte 5 component (props unknown to the shell). */
// biome-ignore lint/suspicious/noExplicitAny: props vary per contribution
export type AnyComponent = Component<any>

export type SvelteClientModule = ClientModule<AnyComponent>
export type SvelteClientRoute = ClientRoute<AnyComponent>
export type SvelteObjectPresenter = ObjectPresenter<AnyComponent>
export type SvelteSidebarContribution = SidebarContribution<AnyComponent>
export type SvelteOverlayContribution = OverlayContribution<AnyComponent>
export type SvelteNotificationRenderer = NotificationRenderer<AnyComponent>
export type SvelteClientSettingsPage = ClientSettingsPage<AnyComponent>
export type SvelteWidgetDefinition = WidgetDefinition<AnyComponent>

export type {
  ClientContext,
  ClientNavItem,
  CommandAction,
  KeyboardShortcut,
  OverlayProps,
  SidebarProps,
  WidgetOption,
  WidgetProps,
  WidgetSettingField,
  WidgetSettings,
  WidgetSettingsContext,
  WidgetSize,
}

export function defineClientModule(mod: SvelteClientModule): SvelteClientModule {
  return defineUntyped(mod)
}
