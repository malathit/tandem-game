import type { SentenceGenerator } from '../generation/generator'
import type { GenerateRequest } from '../generation/types'

export const german = ['Mein Drache frisst gerne Süßigkeiten.', 'Der Drache hat kleine grüne Schuppen.']
export const english = ['My dragon likes to eat sweets.', 'The dragon has small green scales.']
const answers: Record<string, string[]> = { de: german, en: english }

/** A generator that answers at once, and remembers what it was asked. */
export function instantGenerator(language: Record<string, string[]> = answers) {
  const asked: GenerateRequest[] = []
  const generator: SentenceGenerator = {
    generate: async (request) => {
      asked.push(request)
      return language[request.language]
    },
  }
  return { generator, asked }
}
