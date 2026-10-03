import { PRESET_TOPICS } from './topics'
import type { ContentSource, Language } from './types'

const LANGUAGES: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
]

/** The languages and preset topics of the game. The sentences themselves come from the AI. */
export const staticSource: ContentSource = {
  getLanguages: () => [...LANGUAGES],
  getTopics: () => PRESET_TOPICS.map(({ id, name }) => ({ id, name })),
}
