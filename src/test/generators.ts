import type { SentenceGenerator } from '../generation/generator'
import type { GenerateRequest } from '../generation/types'

export const german = ['Mein Drache frisst gerne Süßigkeiten.', 'Der Drache hat kleine grüne Schuppen.']
export const english = ['My dragon likes to eat sweets.', 'The dragon has small green scales.']
// Enough for the longest round; a shorter one takes the first few.
const answers: Record<string, string[]> = {
  de: [...german, 'Wir gehen heute ins Kino.', 'Sie trinkt jeden Morgen Tee.', 'Ich habe einen neuen Freund.'],
  en: [...english, 'We are going to the cinema today.', 'She drinks tea every morning.', 'I have a new friend.'],
}

/**
 * A generator that answers at once, and remembers what it was asked.
 * It gives as many sentences as asked for, and as translations the other language's sentences.
 */
export function instantGenerator(language: Record<string, string[]> = answers) {
  const asked: GenerateRequest[] = []
  const generator: SentenceGenerator = {
    generate: async (request) => {
      asked.push(request)
      const sentences = language[request.language].slice(0, request.count)
      if (!request.translate) return { sentences }
      const other = request.language === 'de' ? 'en' : 'de'
      return { sentences, translations: language[other].slice(0, request.count) }
    },
  }
  return { generator, asked }
}
