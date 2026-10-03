// 32 characters (a power of two, so no modulo bias), without look-alikes (I, O, 0, 1).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const CODE_LENGTH = 5

const randomBytes = (count: number) => crypto.getRandomValues(new Uint8Array(count))

export function generateRoomCode(bytes: (count: number) => Uint8Array = randomBytes): string {
  return Array.from(bytes(CODE_LENGTH), (byte) => ALPHABET[byte % ALPHABET.length]).join('')
}

/** Cleans up what a player typed; returns null if it cannot be a room code. */
export function normalizeRoomCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, '').toUpperCase()
  const valid = code.length === CODE_LENGTH && [...code].every((char) => ALPHABET.includes(char))
  return valid ? code : null
}
