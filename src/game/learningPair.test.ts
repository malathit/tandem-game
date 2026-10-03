import { describe, expect, it } from 'vitest'
import { learningPair } from './learningPair'

describe('learningPair', () => {
  it('has the host learn the guest\'s language and the guest learn the host\'s', () => {
    expect(learningPair('de', 'en')).toEqual(['en', 'de'])
  })
})
