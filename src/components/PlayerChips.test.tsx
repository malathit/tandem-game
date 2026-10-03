import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { staticSource } from '../content/staticSource'
import { PlayerChips } from './PlayerChips'

const languages = staticSource.getLanguages()

describe('PlayerChips', () => {
  it('tells the host "you" and "your partner", never a player number', () => {
    render(<PlayerChips pair={['en', 'de']} languages={languages} me={1} />)
    const items = screen.getAllByRole('listitem').map((item) => item.textContent)
    expect(items).toEqual(['You are learning English', 'Your partner is learning German'])
  })

  it('describes the same game from the guest\'s side', () => {
    render(<PlayerChips pair={['en', 'de']} languages={languages} me={2} />)
    const items = screen.getAllByRole('listitem').map((item) => item.textContent)
    expect(items).toEqual(['Your partner is learning English', 'You are learning German'])
  })

  it('keeps each player\'s colour hook', () => {
    const { container } = render(<PlayerChips pair={['en', 'de']} languages={languages} me={1} />)
    expect([...container.querySelectorAll('li')].map((li) => li.dataset.player)).toEqual(['1', '2'])
  })
})
