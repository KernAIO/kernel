/** Data-driven menu model shared by DropdownMenu and ContextMenu. */
/** A face beside a name: the shape `Avatar` takes, so a menu row can show who it means. */
export interface MenuAvatar {
  id?: string | null
  name?: string | null
  src?: string | null
}

export type MenuItem =
  | {
      type?: 'item'
      id?: string
      label: string
      icon?: string
      /** shown before the label — a person is recognised by their face faster than by their name */
      avatar?: MenuAvatar
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
      avatar?: MenuAvatar
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
