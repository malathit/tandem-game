/** Digits only: a code is easy to say aloud, type on a phone and share in a message. A million codes are enough for one waiting game each. */
export const CODE_LENGTH = 6

// Bytes from this value up are skipped when making a code, so that every digit is equally likely (256 is not a multiple of 10).
const FIRST_UNUSED_BYTE = 250

const randomBytes = (count: number) => crypto.getRandomValues(new Uint8Array(count))

export function generateRoomCode(bytes: (count: number) => Uint8Array = randomBytes): string {
  let code = ''
  while (code.length < CODE_LENGTH) {
    for (const byte of bytes(CODE_LENGTH)) {
      if (byte < FIRST_UNUSED_BYTE && code.length < CODE_LENGTH) code += byte % 10
    }
  }
  return code
}

/** Cleans up what a player typed; returns null if it cannot be a room code. */
export function normalizeRoomCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, '')
  return new RegExp(`^[0-9]{${CODE_LENGTH}}$`).test(code) ? code : null
}
