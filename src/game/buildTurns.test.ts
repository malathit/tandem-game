import { describe, expect, it } from 'vitest'
import type { Sentence } from '../content/types'
import { buildSoloTurns, buildTurns } from './buildTurns'

const make = (prefix: string, count: number): Sentence[] =>
  Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i + 1}`, text: `${prefix} ${i + 1}`, translation: `${prefix} ${i + 1} translated` }))

const sentences = {
  en: Object.freeze(make('en', 4)) as Sentence[],
  de: Object.freeze(make('de', 4)) as Sentence[],
}

const keepOrder = <T>(items: readonly T[]) => [...items]
const reverse = <T>(items: readonly T[]) => [...items].reverse()

// Player 1 speaks German and learns English; Player 2 the other way round.
const pair = [{ knows: 'de', learns: 'en' }, { knows: 'en', learns: 'de' }] as const
// Both speak German and learn English.
const bothGerman = [{ knows: 'de', learns: 'en' }, { knows: 'de', learns: 'en' }] as const

describe('buildTurns', () => {
  it('alternates between the players, two sentences each', () => {
    const turns = buildTurns(pair, sentences, 2, keepOrder)
    expect(turns.map((t) => t.player)).toEqual([1, 2, 1, 2])
  })

  it('shows each player sentences in their native language and tells them what to translate into', () => {
    const [first, second] = buildTurns(pair, sentences, 2, keepOrder)
    // Player 1 learns English, so they read German and translate into English.
    expect(first).toEqual({ player: 1, sentence: { id: 'de1', text: 'de 1', translation: 'de 1 translated' }, learning: 'en' })
    expect(second).toEqual({ player: 2, sentence: { id: 'en1', text: 'en 1', translation: 'en 1 translated' }, learning: 'de' })
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

describe('buildTurns when both players read the same language', () => {
  const german = { de: make('de', 6) }

  it('gives both players German sentences to translate into English, alternating', () => {
    const turns = buildTurns(bothGerman, german, 2, keepOrder)
    expect(turns.map((t) => [t.player, t.learning, t.sentence.id])).toEqual([
      [1, 'en', 'de1'],
      [2, 'en', 'de2'],
      [1, 'en', 'de3'],
      [2, 'en', 'de4'],
    ])
  })

  it('never gives the same sentence to two turns', () => {
    for (let run = 0; run < 50; run++) {
      const ids = buildTurns(bothGerman, german, 3).map((t) => t.sentence.id)
      expect(ids).toHaveLength(6)
      expect(new Set(ids).size).toBe(6)
    }
  })

  it('keeps the turns balanced when the list is short', () => {
    expect(buildTurns(bothGerman, { de: make('de', 5) }, 5, keepOrder).map((t) => t.player)).toEqual([1, 2, 1, 2])
    expect(buildTurns(bothGerman, { de: make('de', 1) }, 5, keepOrder)).toEqual([])
  })

  it('uses the shuffle it is given', () => {
    expect(buildTurns(bothGerman, german, 1, reverse).map((t) => t.sentence.id)).toEqual(['de6', 'de5'])
  })

  it('returns no turns without sentences in that language', () => {
    expect(buildTurns(bothGerman, { en: make('en', 6) })).toEqual([])
  })
})

describe('buildSoloTurns', () => {
  it('gives every turn to Player 1, reading the native language and translating into the one being learned', () => {
    const turns = buildSoloTurns('en', sentences.de, 3, keepOrder)
    expect(turns).toEqual([
      { player: 1, sentence: { id: 'de1', text: 'de 1', translation: 'de 1 translated' }, learning: 'en' },
      { player: 1, sentence: { id: 'de2', text: 'de 2', translation: 'de 2 translated' }, learning: 'en' },
      { player: 1, sentence: { id: 'de3', text: 'de 3', translation: 'de 3 translated' }, learning: 'en' },
    ])
  })

  it('shuffles the sentences without changing the list it was given', () => {
    const turns = buildSoloTurns('en', sentences.de, 4, reverse)
    expect(turns.map((t) => t.sentence.id)).toEqual(['de4', 'de3', 'de2', 'de1'])
    expect(sentences.de.map((s) => s.id)).toEqual(['de1', 'de2', 'de3', 'de4'])
  })

  it('gives fewer turns when there are fewer sentences than asked for, and none when there are none', () => {
    expect(buildSoloTurns('en', sentences.de.slice(0, 2), 5, keepOrder)).toHaveLength(2)
    expect(buildSoloTurns('en', [], 5, keepOrder)).toEqual([])
  })
})
