---
'@kernhq/ui': patch
---

Add the `bug` and `git-branch` icons.

The tracker's project templates name both — Bug and Sub-task have used them since work item types
existed — and neither was in the registry, so both rendered as a blank square. An unregistered name
fails silently, and a name chosen in one repository and rendered in another is exactly where that
goes unnoticed.
