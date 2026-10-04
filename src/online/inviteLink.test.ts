import { describe, expect, it } from 'vitest'
import { buildInviteUrl, readJoinCode } from './inviteLink'

describe('buildInviteUrl', () => {
  it('adds the code to the page address', () => {
    expect(buildInviteUrl('482913', 'https://tandem-game.github.io/')).toBe(
      'https://tandem-game.github.io/?join=482913',
    )
  })

  it('drops any other query and the hash so the link only carries the code', () => {
    expect(buildInviteUrl('482913', 'http://localhost:5173/?join=111222&x=1#top')).toBe(
      'http://localhost:5173/?join=482913',
    )
  })
})

describe('readJoinCode', () => {
  it('reads and cleans up a valid code', () => {
    expect(readJoinCode('?join=482 913')).toBe('482913')
  })

  it('finds the code among other parameters', () => {
    expect(readJoinCode('?utm=mail&join=482913')).toBe('482913')
  })

  it.each([
    ['', 'no query'],
    ['?other=1', 'no join parameter'],
    ['?join=', 'empty code'],
    ['?join=abc', 'too short'],
    ['?join=4829131', 'too long'],
    ['?join=48291a', 'a letter'],
    ['?join=<script>', 'not a code at all'],
  ])('ignores %j (%s)', (search) => {
    expect(readJoinCode(search)).toBeNull()
  })
})
