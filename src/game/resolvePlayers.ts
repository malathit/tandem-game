import type { PlayerLanguages, Players } from '../content/types'

/**
 * The languages each player gets, from what the host and the guest saved.
 * Two players who speak and learn the same languages both keep them, so they read the same language and translate into
 * the same one. In every other case each learns what the other speaks, using the host's settings; that also covers a
 * guest who sent nothing usable.
 */
export function resolvePlayers(host: PlayerLanguages, guest: PlayerLanguages | null): Players {
  if (guest && guest.knows === host.knows && guest.learns === host.learns) return [host, guest]
  return [host, { knows: host.learns, learns: host.knows }]
}
