/** Data-driven menu model shared by DropdownMenu and ContextMenu. */
export type MenuItem =
  | {
      type?: 'item'
      id?: string
      label: string
      icon?: string
      shortcut?: string[]
      hint?: string
      danger?: boolean
      disabled?: boolean
      onSelect?: () => void
      href?: string
      children?: MenuItem[]
    }
  | { type: 'separator' }
  | { type: 'label'; label: string }
  | {
      type: 'checkbox'
      id?: string
      label: string
      icon?: string
      checked: boolean
      disabled?: boolean
      onCheckedChange: (v: boolean) => void
    }
  | {
      type: 'radio'
      id?: string
      value: string
      options: { value: string; label: string; icon?: string }[]
      onValueChange: (v: string) => void
    }
