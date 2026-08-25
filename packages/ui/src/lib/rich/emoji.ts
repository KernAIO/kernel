import { t } from '../i18n.svelte.js'

/**
 * The emoji Kern offers.
 *
 * A deliberately small set — the ones people reach for in a work conversation — held here rather
 * than downloaded. A picker that fetches a megabyte of data the first time somebody wants to say 👍
 * is not worth the completeness, and this list can grow when somebody misses something.
 *
 * The names are what search matches on, so they are written the way somebody would type them:
 * `thumbs up`, not `thumbsup`.
 */

export interface Emoji {
  emoji: string
  name: string
  /** extra words that should find this emoji */
  keywords?: string
}

export interface EmojiGroup {
  id: string
  label: () => string
  emoji: Emoji[]
}

export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    id: 'reactions',
    label: () => t('common.emoji_group_reactions'),
    emoji: [
      { emoji: '👍', name: 'thumbs up', keywords: 'yes agree ok approve +1' },
      { emoji: '👎', name: 'thumbs down', keywords: 'no disagree -1' },
      { emoji: '✅', name: 'check', keywords: 'done tick yes complete' },
      { emoji: '❌', name: 'cross', keywords: 'no wrong fail' },
      { emoji: '🎉', name: 'party', keywords: 'celebrate ship release tada' },
      { emoji: '🚀', name: 'rocket', keywords: 'ship launch deploy fast' },
      { emoji: '👀', name: 'eyes', keywords: 'looking review watching' },
      { emoji: '🙏', name: 'thanks', keywords: 'please pray grateful' },
      { emoji: '🔥', name: 'fire', keywords: 'hot great burning' },
      { emoji: '💯', name: 'hundred', keywords: 'perfect exactly score' },
      { emoji: '⚡', name: 'lightning', keywords: 'fast quick zap' },
      { emoji: '✨', name: 'sparkles', keywords: 'new shiny magic' },
      { emoji: '❤️', name: 'heart', keywords: 'love like' },
      { emoji: '🤝', name: 'handshake', keywords: 'deal agree partner' },
      { emoji: '💪', name: 'strong', keywords: 'muscle power effort' },
      { emoji: '🧠', name: 'brain', keywords: 'smart think idea' },
    ],
  },
  {
    id: 'people',
    label: () => t('common.emoji_group_people'),
    emoji: [
      { emoji: '😀', name: 'grinning', keywords: 'happy smile' },
      { emoji: '😄', name: 'smile', keywords: 'happy joy' },
      { emoji: '😅', name: 'sweat smile', keywords: 'nervous phew' },
      { emoji: '😂', name: 'laughing', keywords: 'lol funny tears' },
      { emoji: '🙂', name: 'slight smile', keywords: 'happy' },
      { emoji: '😉', name: 'wink', keywords: 'joke' },
      { emoji: '😊', name: 'blush', keywords: 'happy shy' },
      { emoji: '😍', name: 'heart eyes', keywords: 'love adore' },
      { emoji: '🤔', name: 'thinking', keywords: 'hmm consider doubt' },
      { emoji: '😐', name: 'neutral', keywords: 'meh flat' },
      { emoji: '🙃', name: 'upside down', keywords: 'irony sarcasm' },
      { emoji: '😴', name: 'sleeping', keywords: 'tired zzz' },
      { emoji: '😭', name: 'crying', keywords: 'sad sob' },
      { emoji: '😱', name: 'screaming', keywords: 'shocked fear' },
      { emoji: '🤯', name: 'mind blown', keywords: 'wow shocked exploding' },
      { emoji: '😎', name: 'sunglasses', keywords: 'cool' },
      { emoji: '🥳', name: 'partying', keywords: 'celebrate birthday' },
      { emoji: '😬', name: 'grimace', keywords: 'awkward yikes' },
      { emoji: '🤷', name: 'shrug', keywords: 'dunno whatever' },
      { emoji: '👋', name: 'wave', keywords: 'hello hi bye' },
      { emoji: '👏', name: 'clap', keywords: 'applause well done' },
      { emoji: '🙌', name: 'raised hands', keywords: 'celebrate praise' },
      { emoji: '🤦', name: 'facepalm', keywords: 'oops obviously' },
      { emoji: '💁', name: 'information', keywords: 'help tipping hand' },
    ],
  },
  {
    id: 'work',
    label: () => t('common.emoji_group_work'),
    emoji: [
      { emoji: '📝', name: 'note', keywords: 'write memo document' },
      { emoji: '📌', name: 'pin', keywords: 'pinned important' },
      { emoji: '📎', name: 'paperclip', keywords: 'attach file' },
      { emoji: '📅', name: 'calendar', keywords: 'date schedule meeting' },
      { emoji: '⏰', name: 'alarm', keywords: 'time reminder deadline' },
      { emoji: '🐛', name: 'bug', keywords: 'defect issue error' },
      { emoji: '🔧', name: 'wrench', keywords: 'fix tool repair' },
      { emoji: '🔨', name: 'hammer', keywords: 'build make' },
      { emoji: '🧪', name: 'test', keywords: 'experiment lab' },
      { emoji: '📦', name: 'package', keywords: 'release ship box' },
      { emoji: '🚧', name: 'construction', keywords: 'wip in progress' },
      { emoji: '🔒', name: 'locked', keywords: 'secure private' },
      { emoji: '🔓', name: 'unlocked', keywords: 'open public' },
      { emoji: '📈', name: 'chart up', keywords: 'growth increase metrics' },
      { emoji: '📉', name: 'chart down', keywords: 'decrease drop' },
      { emoji: '💡', name: 'idea', keywords: 'bulb suggestion' },
      { emoji: '⚠️', name: 'warning', keywords: 'careful caution' },
      { emoji: '🛑', name: 'stop', keywords: 'halt blocked' },
      { emoji: '🔍', name: 'search', keywords: 'find look investigate' },
      { emoji: '☕', name: 'coffee', keywords: 'break morning' },
      { emoji: '🍕', name: 'pizza', keywords: 'food lunch' },
      { emoji: '🎯', name: 'target', keywords: 'goal aim focus' },
      { emoji: '🏁', name: 'finish', keywords: 'done complete race' },
      { emoji: '⭐', name: 'star', keywords: 'favourite important' },
    ],
  },
]

const ALL: Emoji[] = EMOJI_GROUPS.flatMap((group) => group.emoji)

/** Emoji whose name or keywords contain the query, name matches first. */
export function searchEmoji(query: string, limit = 40): Emoji[] {
  const needle = query.toLowerCase()
  const byName: Emoji[] = []
  const byKeyword: Emoji[] = []
  for (const item of ALL) {
    if (item.name.includes(needle)) byName.push(item)
    else if ((item.keywords ?? '').includes(needle)) byKeyword.push(item)
  }
  return [...byName, ...byKeyword].slice(0, limit)
}

/** The four offered straight from a message, without opening the picker. */
export const QUICK_REACTIONS = ['👍', '🎉', '👀', '✅'] as const
