# @kernhq/ui

## 0.1.1

### Patch Changes

- 5e00e9c: Focus the first control in a dialog's body instead of its close button.

  The close button is the first tabbable element in the markup, so it took focus whenever a dialog
  opened. In a dialog whose point is to type something — a new issue, a rename — the first space went
  to the close button and threw the draft away. `Dialog` now moves focus to the first control in its
  body on open, and takes an `initialFocus` prop (an element getter, a selector, or `false` to opt
  out) when that is not the right one. A dialog with nothing focusable in its body keeps the old
  behaviour: activating close is a safe thing for a confirmation to do.

- Updated dependencies [35079b2]
  - @kernhq/kernel@0.1.1
