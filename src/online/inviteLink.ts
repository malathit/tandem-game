import { normalizeRoomCode } from './roomCode'

const PARAM = 'join'

/** The address a partner opens to join: this page plus the game code, nothing else. */
export function buildInviteUrl(code: string, pageUrl: string): string {
  const url = new URL(pageUrl)
  url.search = ''
  url.hash = ''
  url.searchParams.set(PARAM, code)
  return url.toString()
}

/** The game code in a page's query string, or null if there is none or it cannot be valid. */
export function readJoinCode(search: string): string | null {
  const value = new URLSearchParams(search).get(PARAM)
  return value === null ? null : normalizeRoomCode(value)
}
