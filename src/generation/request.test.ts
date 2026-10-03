import { describe, expect, it } from 'vitest'
import { staticSource } from '../content/staticSource'
import { MAX_TOPIC_LENGTH, PRESET_TOPIC_IDS, normalizeTopic, parseGenerateRequest } from './request'

describe('normalizeTopic', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeTopic('  ordering   food \n in a restaurant ')).toBe('ordering food in a restaurant')
  })

  it('removes control characters', () => {
    expect(normalizeTopic('my\u0000 pet\u0007 dragon')).toBe('my pet dragon')
  })

  it('rejects empty topics and ones that are too long', () => {
    expect(normalizeTopic('')).toBeNull()
    expect(normalizeTopic('   \n ')).toBeNull()
    expect(normalizeTopic('x'.repeat(MAX_TOPIC_LENGTH))).not.toBeNull()
    expect(normalizeTopic('x'.repeat(MAX_TOPIC_LENGTH + 1))).toBeNull()
  })

  it('rejects things that are not text', () => {
    expect(normalizeTopic(42)).toBeNull()
    expect(normalizeTopic(null)).toBeNull()
    expect(normalizeTopic({})).toBeNull()
  })

  it('measures the length after cleaning, so padding cannot hide a long topic', () => {
    expect(normalizeTopic(' '.repeat(100) + 'pets')).toBe('pets')
    expect(normalizeTopic('x'.repeat(MAX_TOPIC_LENGTH + 1) + '   ')).toBeNull()
  })
})

describe('parseGenerateRequest', () => {
  it('accepts a preset topic', () => {
    expect(parseGenerateRequest({ language: 'de', topic: { kind: 'preset', id: 'modal-verbs' } })).toEqual({
      language: 'de',
      topic: { kind: 'preset', id: 'modal-verbs' },
      fresh: false,
    })
  })

  it('accepts a custom topic and normalises it', () => {
    expect(
      parseGenerateRequest({ language: 'en', topic: { kind: 'custom', text: '  my   pet dragon ' }, fresh: true }),
    ).toEqual({ language: 'en', topic: { kind: 'custom', text: 'my pet dragon' }, fresh: true })
  })

  it('only accepts preset ids from the allow-list, so nobody can create cache entries at will', () => {
    expect(parseGenerateRequest({ language: 'de', topic: { kind: 'preset', id: 'made-up' } })).toBeNull()
    expect(parseGenerateRequest({ language: 'de', topic: { kind: 'preset', id: '__proto__' } })).toBeNull()
    expect(parseGenerateRequest({ language: 'de', topic: { kind: 'preset', id: 'modal-verbs/../x' } })).toBeNull()
  })

  it('rejects unknown languages and malformed bodies', () => {
    const topic = { kind: 'preset', id: 'modal-verbs' }
    expect(parseGenerateRequest({ language: 'fr', topic })).toBeNull()
    expect(parseGenerateRequest({ topic })).toBeNull()
    expect(parseGenerateRequest({ language: 'de' })).toBeNull()
    expect(parseGenerateRequest({ language: 'de', topic: { kind: 'other', id: 'modal-verbs' } })).toBeNull()
    expect(parseGenerateRequest({ language: 'de', topic: { kind: 'custom', text: '' } })).toBeNull()
    expect(parseGenerateRequest({ language: 'de', topic, fresh: 'yes' })).toBeNull()
    for (const junk of [null, undefined, 'text', 7, [], true]) expect(parseGenerateRequest(junk)).toBeNull()
  })

  it('ignores extra fields instead of passing them on', () => {
    const parsed = parseGenerateRequest({
      language: 'de',
      topic: { kind: 'preset', id: 'conjunctions', extra: 1 },
      count: 500,
      model: 'something-else',
    })
    expect(parsed).toEqual({ language: 'de', topic: { kind: 'preset', id: 'conjunctions' }, fresh: false })
  })
})

describe('PRESET_TOPIC_IDS', () => {
  it('covers every preset topic the game ships with', () => {
    const shipped = staticSource.getTopics(['en', 'de']).map((topic) => topic.id)
    expect([...PRESET_TOPIC_IDS].sort()).toEqual(shipped.sort())
  })
})
