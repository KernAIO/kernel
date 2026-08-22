import type { LucideProps } from '@lucide/svelte'
import Activity from '@lucide/svelte/icons/activity'
import Archive from '@lucide/svelte/icons/archive'
import ArrowLeft from '@lucide/svelte/icons/arrow-left'
import ArrowRight from '@lucide/svelte/icons/arrow-right'
import ArrowUp from '@lucide/svelte/icons/arrow-up'
import AtSign from '@lucide/svelte/icons/at-sign'
import Bell from '@lucide/svelte/icons/bell'
import BellOff from '@lucide/svelte/icons/bell-off'
import Bookmark from '@lucide/svelte/icons/bookmark'
import Bot from '@lucide/svelte/icons/bot'
import Briefcase from '@lucide/svelte/icons/briefcase'
import Bug from '@lucide/svelte/icons/bug'
import Building2 from '@lucide/svelte/icons/building-2'
import Calendar from '@lucide/svelte/icons/calendar'
import Check from '@lucide/svelte/icons/check'
import ChevronDown from '@lucide/svelte/icons/chevron-down'
import ChevronLeft from '@lucide/svelte/icons/chevron-left'
import ChevronRight from '@lucide/svelte/icons/chevron-right'
import ChevronUp from '@lucide/svelte/icons/chevron-up'
import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down'
import Circle from '@lucide/svelte/icons/circle'
import CircleAlert from '@lucide/svelte/icons/circle-alert'
import CircleCheck from '@lucide/svelte/icons/circle-check'
import CircleHelp from '@lucide/svelte/icons/circle-help'
import CircleUser from '@lucide/svelte/icons/circle-user'
import Clock from '@lucide/svelte/icons/clock'
import Columns3 from '@lucide/svelte/icons/columns-3'
import Command from '@lucide/svelte/icons/command'
import Copy from '@lucide/svelte/icons/copy'
import Database from '@lucide/svelte/icons/database'
import Diamond from '@lucide/svelte/icons/diamond'
import Download from '@lucide/svelte/icons/download'
import Ellipsis from '@lucide/svelte/icons/ellipsis'
import ExternalLink from '@lucide/svelte/icons/external-link'
import Eye from '@lucide/svelte/icons/eye'
import EyeOff from '@lucide/svelte/icons/eye-off'
import FileText from '@lucide/svelte/icons/file-text'
import Filter from '@lucide/svelte/icons/filter'
import Flag from '@lucide/svelte/icons/flag'
import Folder from '@lucide/svelte/icons/folder'
import GitBranch from '@lucide/svelte/icons/git-branch'
import Globe from '@lucide/svelte/icons/globe'
import Hash from '@lucide/svelte/icons/hash'
import House from '@lucide/svelte/icons/house'
import Image from '@lucide/svelte/icons/image'
import Inbox from '@lucide/svelte/icons/inbox'
import Info from '@lucide/svelte/icons/info'
import Kanban from '@lucide/svelte/icons/kanban'
import KeyRound from '@lucide/svelte/icons/key-round'
import Languages from '@lucide/svelte/icons/languages'
import LayoutGrid from '@lucide/svelte/icons/layout-grid'
import Link from '@lucide/svelte/icons/link'
import List from '@lucide/svelte/icons/list'
import Loader from '@lucide/svelte/icons/loader-circle'
import Lock from '@lucide/svelte/icons/lock'
import LogOut from '@lucide/svelte/icons/log-out'
import Mail from '@lucide/svelte/icons/mail'
import Menu from '@lucide/svelte/icons/menu'
import MessageCircle from '@lucide/svelte/icons/message-circle'
import MessageSquareText from '@lucide/svelte/icons/message-square-text'
import Mic from '@lucide/svelte/icons/mic'
import Monitor from '@lucide/svelte/icons/monitor'
import Moon from '@lucide/svelte/icons/moon'
import Palette from '@lucide/svelte/icons/palette'
import PanelRight from '@lucide/svelte/icons/panel-right'
import Paperclip from '@lucide/svelte/icons/paperclip'
import Pencil from '@lucide/svelte/icons/pencil'
import Play from '@lucide/svelte/icons/play'
import Plug from '@lucide/svelte/icons/plug'
import Plus from '@lucide/svelte/icons/plus'
import Puzzle from '@lucide/svelte/icons/puzzle'
import RefreshCw from '@lucide/svelte/icons/refresh-cw'
import ScrollText from '@lucide/svelte/icons/scroll-text'
import Search from '@lucide/svelte/icons/search'
import Settings from '@lucide/svelte/icons/settings'
import Shield from '@lucide/svelte/icons/shield'
import ShieldCheck from '@lucide/svelte/icons/shield-check'
import Slash from '@lucide/svelte/icons/slash'
import SlidersVertical from '@lucide/svelte/icons/sliders-vertical'
import Smartphone from '@lucide/svelte/icons/smartphone'
import Smile from '@lucide/svelte/icons/smile'
import Sparkles from '@lucide/svelte/icons/sparkles'
import Square from '@lucide/svelte/icons/square'
import SquareCheckBig from '@lucide/svelte/icons/square-check-big'
import SquarePen from '@lucide/svelte/icons/square-pen'
import Star from '@lucide/svelte/icons/star'
import Sun from '@lucide/svelte/icons/sun'
import Tag from '@lucide/svelte/icons/tag'
import Target from '@lucide/svelte/icons/target'
import Trash2 from '@lucide/svelte/icons/trash-2'
import TriangleAlert from '@lucide/svelte/icons/triangle-alert'
import Upload from '@lucide/svelte/icons/upload'
import User from '@lucide/svelte/icons/user'
import UserPlus from '@lucide/svelte/icons/user-plus'
import Users from '@lucide/svelte/icons/users'
import Video from '@lucide/svelte/icons/video'
import Wifi from '@lucide/svelte/icons/wifi'
import WifiOff from '@lucide/svelte/icons/wifi-off'
import Wrench from '@lucide/svelte/icons/wrench'
import X from '@lucide/svelte/icons/x'
import Zap from '@lucide/svelte/icons/zap'
import type { Component } from 'svelte'

export type IconComponent = Component<LucideProps>

/**
 * Curated icon registry (lucide names → components). Modules reference icons by name
 * (`icon: 'target'`) so the app stays tree-shaken; call `registerIcons` to add more.
 */
const registry: Record<string, IconComponent> = {
  activity: Activity,
  archive: Archive,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  'at-sign': AtSign,
  bell: Bell,
  'bell-off': BellOff,
  bookmark: Bookmark,
  bug: Bug,
  bot: Bot,
  briefcase: Briefcase,
  'building-2': Building2,
  building: Building2,
  calendar: Calendar,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  'chevrons-up-down': ChevronsUpDown,
  circle: Circle,
  'circle-alert': CircleAlert,
  'circle-check': CircleCheck,
  'circle-help': CircleHelp,
  'circle-user': CircleUser,
  clock: Clock,
  'columns-3': Columns3,
  command: Command,
  copy: Copy,
  database: Database,
  diamond: Diamond,
  download: Download,
  ellipsis: Ellipsis,
  'external-link': ExternalLink,
  eye: Eye,
  'eye-off': EyeOff,
  'file-text': FileText,
  doc: FileText,
  filter: Filter,
  flag: Flag,
  folder: Folder,
  'git-branch': GitBranch,
  globe: Globe,
  hash: Hash,
  house: House,
  home: House,
  image: Image,
  inbox: Inbox,
  info: Info,
  'key-round': KeyRound,
  kanban: Kanban,
  languages: Languages,
  'layout-grid': LayoutGrid,
  link: Link,
  list: List,
  loader: Loader,
  lock: Lock,
  'log-out': LogOut,
  mail: Mail,
  menu: Menu,
  'message-circle': MessageCircle,
  chat: MessageCircle,
  'message-square-text': MessageSquareText,
  mic: Mic,
  monitor: Monitor,
  moon: Moon,
  palette: Palette,
  'panel-right': PanelRight,
  paperclip: Paperclip,
  pencil: Pencil,
  play: Play,
  plug: Plug,
  plus: Plus,
  puzzle: Puzzle,
  'refresh-cw': RefreshCw,
  'scroll-text': ScrollText,
  search: Search,
  settings: Settings,
  shield: Shield,
  'shield-check': ShieldCheck,
  slash: Slash,
  'sliders-vertical': SlidersVertical,
  smartphone: Smartphone,
  smile: Smile,
  sparkles: Sparkles,
  square: Square,
  'square-check-big': SquareCheckBig,
  'square-pen': SquarePen,
  star: Star,
  sun: Sun,
  tag: Tag,
  target: Target,
  'trash-2': Trash2,
  trash: Trash2,
  'triangle-alert': TriangleAlert,
  upload: Upload,
  user: User,
  'user-plus': UserPlus,
  users: Users,
  video: Video,
  wifi: Wifi,
  'wifi-off': WifiOff,
  wrench: Wrench,
  x: X,
  zap: Zap,
}

export function registerIcons(more: Record<string, IconComponent>) {
  Object.assign(registry, more)
}
export function getIcon(name: string | undefined | null): IconComponent | undefined {
  return name ? registry[name] : undefined
}
export const iconNames = () => Object.keys(registry)
