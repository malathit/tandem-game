import { createHttpGenerator, type SentenceGenerator } from './generator'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

/**
 * The Worker's address from the build setting, or null if there is none or it is not safe to use:
 * https only (plain http is fine for a Worker on this computer), and no embedded credentials.
 */
export function parseGeneratorUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  if (url.username !== '' || url.password !== '') return null
  const secure = url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))
  return secure ? url.href : null
}

/** A generator for the configured Worker, or undefined so the game plays hand-written topics only. */
export function generatorFromUrl(value: unknown): SentenceGenerator | undefined {
  const url = parseGeneratorUrl(value)
  return url === null ? undefined : createHttpGenerator(url)
}
