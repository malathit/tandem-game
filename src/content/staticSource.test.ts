import { describe, expect, it } from 'vitest'
import { staticSource } from './staticSource'
import { PRESET_TOPICS } from './topics'

describe('staticSource', () => {
  it('lists the supported languages', () => {
    expect(staticSource.getLanguages().map((l) => l.code)).toEqual(['en', 'de'])
  })

  it('offers the ten preset topics, without the AI hints', () => {
    const topics = staticSource.getTopics()
    expect(topics).toHaveLength(10)
    expect(topics[0]).toEqual({ id: 'greetings', name: 'Greetings and small talk' })
  })

  it('does not let callers change the topics or languages', () => {
    staticSource.getTopics().pop()
    staticSource.getLanguages().pop()
    expect(staticSource.getTopics()).toHaveLength(10)
    expect(staticSource.getLanguages()).toHaveLength(2)
  })
})

describe('preset topics', () => {
  it('have unique ids made of lowercase letters and dashes', () => {
    const ids = PRESET_TOPICS.map((topic) => topic.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/)
  })

  it('have a name and a hint for the AI', () => {
    for (const topic of PRESET_TOPICS) {
      expect(topic.name.trim()).not.toBe('')
      expect(topic.hint.trim()).not.toBe('')
    }
  })

  it('keep the hints short enough to stay a theme, not a prompt', () => {
    for (const topic of PRESET_TOPICS) expect(topic.hint.length).toBeLessThanOrEqual(160)
  })
})
