---
'@kernhq/ui': minor
---

Make every control readable, named and reachable.

The ink scale ran to 2.5:1 below step 450, six of nine avatar grounds carried white initials below
4.5:1, four badge tones failed against their own tint, and `.v-danger` put `#fff` on a light red in
dark mode — on the button that deletes a project. Each is now measured against the palest surface it
sits on. `--kern-accent-badge-bg` / `-fg` is the pair for text on the accent, which white never
cleared in either theme.

`IDENTITY_COLORS` names the `--kern-av-*` tokens instead of repeating their hexes, so the palette
has one definition and changing it reaches the avatars.

`Checkbox` and `Switch` render as buttons, which a `<label>` cannot name; both now point
`aria-labelledby` at their visible text, or adopt an external `<label for>` by id. `SearchBox` and a
bare `Input` take their name from their placeholder when nothing else names them.

`PageHeader` sets the browser tab from its title, disabled controls sit at 0.7 rather than 0.5 so
their labels stay legible, the picker inputs (`file`, `date`, `time`, `color`, `checkbox`, `radio`)
show a pointer, and the tab close button has a 24px hit area behind its 15px icon.

Adds `calendar-days`, `check-check`, `toggle-left` and `tree-palm` to the icon registry.
