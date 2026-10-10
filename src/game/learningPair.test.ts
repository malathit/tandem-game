import { describe, expect, it } from 'vitest'
import { learningPair } from './learningPair'

describe('learningPair', () => {
  it('is what each player learns, in player order', () => {
    expect(learningPair([{ knows: 'de', learns: 'en' }, { knows: 'en', learns: 'de' }])).toEqual(['en', 'de'])
  })

  it('is the same language twice when both players learn it', () => {
    expect(learningPair([{ knows: 'de', learns: 'en' }, { knows: 'de', learns: 'en' }])).toEqual(['en', 'en'])
  })
})
