import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadHostDefaults, loadLastTopic, saveHostDefaults, saveLastTopic } from './hostPreferences'

const defaults = { knows: 'de', learns: 'en', options: { count: 4, difficulty: 'hard', review: true } } as const

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('host defaults', () => {
  it('are empty until saved', () => {
    expect(loadHostDefaults()).toBeNull()
  })

  it('round-trip', () => {
    saveHostDefaults(defaults)
    expect(loadHostDefaults()).toEqual(defaults)
  })

  it('saved before translations became automatic still load, without the old flag', () => {
    localStorage.setItem('tandem.hostDefaults.v2', JSON.stringify({ ...defaults, options: { ...defaults.options, translate: false } }))
    expect(loadHostDefaults()).toEqual(defaults)
  })

  it('saved before the review became optional still load, with the review off', () => {
    localStorage.setItem('tandem.hostDefaults.v2', JSON.stringify({ ...defaults, options: { count: 4, difficulty: 'hard' } }))
    expect(loadHostDefaults()).toEqual({ ...defaults, options: { ...defaults.options, review: false } })
  })

  it('keep a host who turned the review on', () => {
    saveHostDefaults(defaults)
    expect(loadHostDefaults()).toEqual(defaults)
  })

  it.each([
    ['not JSON', 'nope'],
    ['not an object', '"x"'],
    ['null', 'null'],
    ['an unknown language', JSON.stringify({ ...defaults, knows: 'fr' })],
    ['an unknown learning language', JSON.stringify({ ...defaults, learns: 'fr' })],
    ['no learning language', JSON.stringify({ knows: 'de', options: defaults.options })],
    ['the same language to speak and to learn', JSON.stringify({ ...defaults, learns: 'de' })],
    ['a count below the minimum', JSON.stringify({ ...defaults, options: { ...defaults.options, count: 0 } })],
    ['a count above the maximum', JSON.stringify({ ...defaults, options: { ...defaults.options, count: 6 } })],
    ['a fractional count', JSON.stringify({ ...defaults, options: { ...defaults.options, count: 2.5 } })],
    ['an unknown difficulty', JSON.stringify({ ...defaults, options: { ...defaults.options, difficulty: 'insane' } })],
    ['a review flag that is not a boolean', JSON.stringify({ ...defaults, options: { ...defaults.options, review: 'no' } })],
    ['missing options', JSON.stringify({ knows: 'en' })],
  ])('are ignored when the stored value is %s', (_, stored) => {
    localStorage.setItem('tandem.hostDefaults.v2', stored)
    expect(loadHostDefaults()).toBeNull()
  })

  it('drop unknown fields', () => {
    localStorage.setItem('tandem.hostDefaults.v2', JSON.stringify({ ...defaults, extra: 1 }))
    expect(loadHostDefaults()).toEqual(defaults)
  })

  it('survive storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(loadHostDefaults()).toBeNull()
    expect(() => saveHostDefaults(defaults)).not.toThrow()
  })
})

describe('last topic', () => {
  it('is empty until saved', () => {
    expect(loadLastTopic()).toBeNull()
  })

  it('round-trips a preset id or custom text', () => {
    saveLastTopic('weather')
    expect(loadLastTopic()).toBe('weather')
    saveLastTopic('my pet dragon')
    expect(loadLastTopic()).toBe('my pet dragon')
  })

  it('is ignored when blank or longer than a topic may be', () => {
    localStorage.setItem('tandem.lastTopic.v1', '   ')
    expect(loadLastTopic()).toBeNull()
    localStorage.setItem('tandem.lastTopic.v1', 'x'.repeat(61))
    expect(loadLastTopic()).toBeNull()
  })

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(loadLastTopic()).toBeNull()
    expect(() => saveLastTopic('weather')).not.toThrow()
  })
})
