import { PRESET_TOPICS } from '../content/topics'
import { isLanguageCode } from '../content/types'
import { DEFAULT_COUNT, MAX_COUNT, MIN_COUNT, type GenerateRequest, type GenerateTopic } from './types'

export const MAX_TOPIC_LENGTH = 60

/** Preset topics the Worker may keep stored sentences for. */
export const PRESET_TOPIC_IDS: readonly string[] = PRESET_TOPICS.map((topic) => topic.id)

/** Cleans a typed topic; null if it is empty, too long or not text. */
export function normalizeTopic(value: unknown): string | null {
  if (typeof value !== 'string') return null
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > 0 && text.length <= MAX_TOPIC_LENGTH ? text : null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function parseTopic(value: unknown): GenerateTopic | null {
  if (!isRecord(value)) return null
  if (value.kind === 'preset') {
    return typeof value.id === 'string' && PRESET_TOPIC_IDS.includes(value.id)
      ? { kind: 'preset', id: value.id }
      : null
  }
  if (value.kind === 'custom') {
    const text = normalizeTopic(value.text)
    return text === null ? null : { kind: 'custom', text }
  }
  return null
}

/** Validates an untrusted request body; null if anything is wrong. Extra fields are dropped. */
export function parseGenerateRequest(value: unknown): GenerateRequest | null {
  if (!isRecord(value) || !isLanguageCode(value.language)) return null
  if (value.fresh !== undefined && typeof value.fresh !== 'boolean') return null
  if (value.translate !== undefined && typeof value.translate !== 'boolean') return null
  const count = value.count === undefined ? DEFAULT_COUNT : value.count
  if (typeof count !== 'number' || !Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT) return null
  const topic = parseTopic(value.topic)
  return topic === null
    ? null
    : { language: value.language, topic, fresh: value.fresh ?? false, count, translate: value.translate ?? false }
}
