import { describe, expect, it } from 'vitest'
import { buildInviteUrl, readJoinCode } from './inviteLink'

describe('buildInviteUrl', () => {
  it('adds the code to the page address', () => {
    expect(buildInviteUrl('K7QXZ', 'https://www.malathi.dev/tandem-game/')).toBe(
      'https://www.malathi.dev/tandem-game/?join=K7QXZ',
    )
  })

  it('drops any other query and the hash so the link only carries the code', () => {
    expect(buildInviteUrl('K7QXZ', 'http://localhost:5173/tandem-game/?join=OLD22&x=1#top')).toBe(
      'http://localhost:5173/tandem-game/?join=K7QXZ',
    )
  })
})

describe('readJoinCode', () => {
  it('reads and cleans up a valid code', () => {
    expect(readJoinCode('?join=k7qxz')).toBe('K7QXZ')
  })

  it('finds the code among other parameters', () => {
    expect(readJoinCode('?utm=mail&join=K7QXZ')).toBe('K7QXZ')
  })

  it.each([
    ['', 'no query'],
    ['?other=1', 'no join parameter'],
    ['?join=', 'empty code'],
    ['?join=abc', 'too short'],
    ['?join=K7QXZ1', 'too long'],
    ['?join=K7QX0', 'look-alike character'],
    ['?join=<script>', 'not a code at all'],
  ])('ignores %j (%s)', (search) => {
    expect(readJoinCode(search)).toBeNull()
  })
})
