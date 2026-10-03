import { describe, expect, it } from 'vitest'
import { createStaticSource, staticSource } from './staticSource'

const sentences = (prefix: string, count = 2) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i + 1}`,
    text: `${prefix} sentence ${i + 1}`,
  }))

const files = {
  './data/en/modal-verbs.json': sentences('en-mv'),
  './data/de/modal-verbs.json': sentences('de-mv'),
  './data/en/conjunctions.json': sentences('en-conj'),
}

describe('createStaticSource', () => {
  const source = createStaticSource(files)

  it('lists the supported languages', () => {
    expect(source.getLanguages().map((l) => l.code)).toEqual(['en', 'de'])
  })

  it('returns sentences for a language and topic', () => {
    expect(source.getSentences('de', 'modal-verbs')).toEqual(sentences('de-mv'))
  })

  it('returns no sentences for a topic without content in that language', () => {
    expect(source.getSentences('de', 'conjunctions')).toEqual([])
  })

  it('returns no sentences for an unknown topic such as free text', () => {
    expect(source.getSentences('en', 'something I typed')).toEqual([])
  })

  it('only offers topics that have sentences in both languages', () => {
    expect(source.getTopics(['en', 'de']).map((t) => t.id)).toEqual(['modal-verbs'])
  })

  it('offers the same topics regardless of language order', () => {
    expect(source.getTopics(['de', 'en'])).toEqual(source.getTopics(['en', 'de']))
  })

  it('treats a topic with an empty sentence list as having no content', () => {
    const empty = createStaticSource({ ...files, './data/de/conjunctions.json': [] })
    expect(empty.getTopics(['en', 'de']).map((t) => t.id)).toEqual(['modal-verbs'])
  })

  it('does not let callers mutate the stored sentences', () => {
    source.getSentences('en', 'modal-verbs').pop()
    expect(source.getSentences('en', 'modal-verbs')).toHaveLength(2)
  })
})

describe('createStaticSource validation', () => {
  it('rejects a file that is not a list', () => {
    expect(() => createStaticSource({ './data/en/modal-verbs.json': {} })).toThrow(
      /data\/en\/modal-verbs\.json/,
    )
  })

  it('rejects a sentence without text', () => {
    expect(() =>
      createStaticSource({ './data/en/modal-verbs.json': [{ id: 'a', text: '  ' }] }),
    ).toThrow(/data\/en\/modal-verbs\.json/)
  })

  it('rejects duplicate sentence ids within a file', () => {
    expect(() =>
      createStaticSource({
        './data/en/modal-verbs.json': [
          { id: 'a', text: 'one' },
          { id: 'a', text: 'two' },
        ],
      }),
    ).toThrow(/duplicate/i)
  })

  it('rejects a file for an unknown language', () => {
    expect(() => createStaticSource({ './data/xx/modal-verbs.json': sentences('x') })).toThrow(
      /unknown language/i,
    )
  })

  it('rejects a file for an unknown topic', () => {
    expect(() => createStaticSource({ './data/en/poetry.json': sentences('x') })).toThrow(
      /unknown topic/i,
    )
  })
})

describe('bundled seed content', () => {
  const pair = ['en', 'de'] as const

  it('offers modal verbs and conjunctions for English and German', () => {
    expect(staticSource.getTopics(pair).map((t) => t.id)).toEqual([
      'modal-verbs',
      'conjunctions',
    ])
  })

  it.each(['modal-verbs', 'conjunctions'])(
    'has enough sentences in both languages for %s',
    (topicId) => {
      for (const language of pair) {
        expect(staticSource.getSentences(language, topicId).length).toBeGreaterThanOrEqual(2)
      }
    },
  )
})
