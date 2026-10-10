import { describe, expect, it } from 'vitest'
import { resolvePlayers } from './resolvePlayers'

const germanLearningEnglish = { knows: 'de', learns: 'en' } as const
const englishLearningGerman = { knows: 'en', learns: 'de' } as const

describe('resolvePlayers', () => {
  it('keeps both settings when the players speak and learn the same languages', () => {
    expect(resolvePlayers(germanLearningEnglish, germanLearningEnglish)).toEqual([germanLearningEnglish, germanLearningEnglish])
    expect(resolvePlayers(englishLearningGerman, englishLearningGerman)).toEqual([englishLearningGerman, englishLearningGerman])
  })

  it('keeps both settings when each learns what the other speaks', () => {
    expect(resolvePlayers(germanLearningEnglish, englishLearningGerman)).toEqual([germanLearningEnglish, englishLearningGerman])
  })

  it('has the guest speak what the host learns when the guest sent no settings', () => {
    expect(resolvePlayers(germanLearningEnglish, null)).toEqual([germanLearningEnglish, englishLearningGerman])
  })

  it("lets the host's settings win when the guest's match neither way", () => {
    const odd = { knows: 'de', learns: 'de' } as const
    expect(resolvePlayers(germanLearningEnglish, odd)).toEqual([germanLearningEnglish, englishLearningGerman])
    expect(resolvePlayers(germanLearningEnglish, { knows: 'en', learns: 'en' })).toEqual([
      germanLearningEnglish,
      englishLearningGerman,
    ])
  })
})
