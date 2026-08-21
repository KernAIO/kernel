import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge class names (clsx + tailwind-merge). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Identity colours from DESIGN.md §1.1 — index 0 is the default. */
export const IDENTITY_COLORS = [
  '#8E8779',
  '#7E6A93',
  '#5F7383',
  '#B7714E',
  '#6E8B62',
  '#85947A',
  '#B4661C',
  '#A05A48',
  '#B49A5F',
] as const

/** Deterministic identity colour for a user/project id (hash → 1..8; 0 is reserved for "default"). */
export function identityColor(seed: string | null | undefined): string {
  if (!seed) return IDENTITY_COLORS[0]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  const idx = (Math.abs(h) % (IDENTITY_COLORS.length - 1)) + 1
  return IDENTITY_COLORS[idx] ?? IDENTITY_COLORS[0]
}

/** "Navid Mirza" → "NM", "ines" → "IN", "" → "?" */
export function initials(name: string | null | undefined, max = 2): string {
  if (!name) return '?'
  const parts = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, max).toUpperCase()
  return parts
    .slice(0, max)
    .map((p) => p[0]!)
    .join('')
    .toUpperCase()
}

/** Avatar radius per DESIGN.md: round(size × 0.3) */
export const avatarRadius = (size: number) => Math.round(size * 0.3)
/** Avatar font size per DESIGN.md: max(9, round(size × 0.38)) */
export const avatarFontSize = (size: number) => Math.max(9, Math.round(size * 0.38))

/** Is the current platform Apple (for ⌘ vs Ctrl hints)? */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? '') || /Mac/.test(navigator.userAgent)
}

/** Format a key combo like ['mod','k'] → "⌘K" / "Ctrl K". */
export function formatKeys(keys: string[]): string {
  const mac = isMac()
  return keys
    .map((k) => {
      switch (k.toLowerCase()) {
        case 'mod':
          return mac ? '⌘' : 'Ctrl'
        case 'meta':
          return '⌘'
        case 'shift':
          return mac ? '⇧' : 'Shift'
        case 'alt':
          return mac ? '⌥' : 'Alt'
        case 'ctrl':
          return mac ? '⌃' : 'Ctrl'
        case 'enter':
          return '↵'
        case 'escape':
          return 'Esc'
        case 'then':
          return 'then'
        default:
          return k.length === 1 ? k.toUpperCase() : k
      }
    })
    .join(mac ? '' : ' ')
    .replace(/then/g, ' then ')
}

/** Relative time: "just now", "4m", "2h", "3d", else short date. */
export function timeAgo(iso: string | Date, now = Date.now()): string {
  const t = typeof iso === 'string' ? Date.parse(iso) : iso.getTime()
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 45) return 'now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d`
  const dt = new Date(t)
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Tiny id helper for aria wiring. */
let _uid = 0
export const uid = (prefix = 'k') => `${prefix}-${++_uid}`
