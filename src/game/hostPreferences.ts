import { isLanguageCode, type LanguageCode } from '../content/types'
import { MAX_TOPIC_LENGTH } from '../generation/request'
import { DEFAULT_ROUND_OPTIONS, MAX_COUNT, MIN_COUNT, isDifficulty, type RoundOptions } from '../generation/types'

/** What the host keeps from game to game: the language they speak, the one they learn, and the round options. */
export interface HostDefaults {
  /** What the player reads: their sentences are written in it. */
  knows: LanguageCode
  /** What the host practises: it is the language the partner speaks. Never the same as `knows`. */
  learns: LanguageCode
  options: RoundOptions
}

const DEFAULTS_KEY = 'tandem.hostDefaults.v2'
const TOPIC_KEY = 'tandem.lastTopic.v1'

// Storage can be missing or throw (private windows, blocked site data), and its content is untrusted:
// anything unusable reads as "nothing saved".
function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Not saving is fine: the host just configures again next time.
  }
}

function parseOptions(value: unknown): RoundOptions | null {
  if (typeof value !== 'object' || value === null) return null
  const { count, difficulty, review = DEFAULT_ROUND_OPTIONS.review } = value as Record<string, unknown>
  if (typeof count !== 'number' || !Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT) return null
  if (!isDifficulty(difficulty) || typeof review !== 'boolean') return null
  return { count, difficulty, review }
}

export function loadHostDefaults(): HostDefaults | null {
  const stored = read(DEFAULTS_KEY)
  if (stored === null) return null
  try {
    const { knows, learns, options } = JSON.parse(stored) as Record<string, unknown>
    const parsed = parseOptions(options)
    return isLanguageCode(knows) && isLanguageCode(learns) && knows !== learns && parsed
      ? { knows, learns, options: parsed }
      : null
  } catch {
    return null
  }
}

export const saveHostDefaults = ({ knows, learns, options }: HostDefaults) =>
  write(DEFAULTS_KEY, JSON.stringify({ knows, learns, options }))

/** The topic of the host's last game: a preset's id, or the text they typed. */
export function loadLastTopic(): string | null {
  const stored = read(TOPIC_KEY)?.trim()
  return stored && stored.length <= MAX_TOPIC_LENGTH ? stored : null
}

export const saveLastTopic = (topic: string) => write(TOPIC_KEY, topic)

/** What a first visit starts from: a German speaker learns English, anyone else learns German. */
export function suggestHostDefaults(browserLanguage: string = navigator.language): HostDefaults {
  const german = browserLanguage.toLowerCase().startsWith('de')
  return { knows: german ? 'de' : 'en', learns: german ? 'en' : 'de', options: DEFAULT_ROUND_OPTIONS }
}
