import { describe, expect, it } from 'vitest'
import type { Sentence } from '../content/types'
import { buildTurns } from './buildTurns'

const make = (prefix: string, count: number): Sentence[] =>
  Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i + 1}`, text: `${prefix} ${i + 1}` }))

const sentences = {
  en: Object.freeze(make('en', 4)) as Sentence[],
  de: Object.freeze(make('de', 4)) as Sentence[],
}

const keepOrder = <T>(items: readonly T[]) => [...items]
const reverse = <T>(items: readonly T[]) => [...items].reverse()

// pair = [what Player 1 is learning, what Player 2 is learning]
const pair = ['en', 'de'] as const

describe('buildTurns', () => {
  it('alternates between the players, two sentences each', () => {
    const turns = buildTurns(pair, sentences, 2, keepOrder)
    expect(turns.map((t) => t.player)).toEqual([1, 2, 1, 2])
  })

  it('shows each player sentences in their native language and tells them what to translate into', () => {
    const [first, second] = buildTurns(pair, sentences, 2, keepOrder)
    // Player 1 learns English, so they read German and translate into English.
    expect(first).toEqual({ player: 1, sentence: { id: 'de1', text: 'de 1' }, learning: 'en' })
    expect(second).toEqual({ player: 2, sentence: { id: 'en1', text: 'en 1' }, learning: 'de' })
  })

  it('uses the shuffle it is given to choose and order the sentences', () => {
    const turns = buildTurns(pair, sentences, 2, reverse)
    expect(turns.map((t) => t.sentence.id)).toEqual(['de4', 'en4', 'de3', 'en3'])
  })

  it('never repeats a sentence within a round', () => {
    for (let run = 0; run < 50; run++) {
      const ids = buildTurns(pair, sentences).map((t) => t.sentence.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('shortens the round to the language with fewer sentences', () => {
    const short = { en: make('en', 4), de: make('de', 1) }
    expect(buildTurns(pair, short, 2, keepOrder).map((t) => t.player)).toEqual([1, 2])
  })

  it('gives each player as many turns as the host chose, up to what there is', () => {
    expect(buildTurns(pair, sentences, 1, keepOrder).map((t) => t.player)).toEqual([1, 2])
    expect(buildTurns(pair, sentences, 4, keepOrder)).toHaveLength(8)
    expect(buildTurns(pair, sentences, 5, keepOrder)).toHaveLength(8)
  })

  it('keeps the translation with its sentence', () => {
    const translated = { en: [{ id: 'en1', text: 'a', translation: 'A' }], de: [{ id: 'de1', text: 'b', translation: 'B' }] }
    const [first, second] = buildTurns(pair, translated, 1, keepOrder)
    expect(first.sentence.translation).toBe('B')
    expect(second.sentence.translation).toBe('A')
  })

  it('returns no turns when a language has no sentences', () => {
    expect(buildTurns(pair, { en: make('en', 4) })).toEqual([])
    expect(buildTurns(pair, { en: make('en', 4), de: [] })).toEqual([])
  })

  it('does not change the lists it is given', () => {
    buildTurns(pair, sentences)
    expect(sentences.en.map((s) => s.id)).toEqual(['en1', 'en2', 'en3', 'en4'])
  })
})
