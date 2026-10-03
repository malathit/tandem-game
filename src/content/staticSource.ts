import type {
  ContentSource,
  Language,
  LanguageCode,
  Sentence,
  Topic,
} from './types'

const LANGUAGES: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
]

const TOPICS: Topic[] = [
  { id: 'modal-verbs', name: 'Modal verbs' },
  { id: 'conjunctions', name: 'Conjunctions' },
]

// Content files live at ./data/<language code>/<topic id>.json
const FILE_PATH = /\/data\/([^/]+)\/([^/]+)\.json$/

const keyOf = (language: string, topicId: string) => `${language}/${topicId}`

function parseSentences(path: string, data: unknown): Sentence[] {
  if (!Array.isArray(data)) {
    throw new Error(`${path}: expected a list of sentences`)
  }
  const ids = new Set<string>()
  return data.map((item, index) => {
    const { id, text } = (item ?? {}) as Record<string, unknown>
    if (typeof id !== 'string' || !id.trim() || typeof text !== 'string' || !text.trim()) {
      throw new Error(`${path}: sentence ${index + 1} needs a non-empty id and text`)
    }
    if (ids.has(id)) {
      throw new Error(`${path}: duplicate sentence id "${id}"`)
    }
    ids.add(id)
    return { id, text }
  })
}

/** Builds a content source from files keyed by path; validates them up front. */
export function createStaticSource(files: Readonly<Record<string, unknown>>): ContentSource {
  const sentencesByKey = new Map<string, Sentence[]>()

  for (const [path, data] of Object.entries(files)) {
    const match = FILE_PATH.exec(path)
    if (!match) {
      throw new Error(`${path}: expected a path like ./data/<language>/<topic>.json`)
    }
    const [, language, topicId] = match
    if (!LANGUAGES.some((l) => l.code === language)) {
      throw new Error(`${path}: unknown language "${language}"`)
    }
    if (!TOPICS.some((t) => t.id === topicId)) {
      throw new Error(`${path}: unknown topic "${topicId}"`)
    }
    sentencesByKey.set(keyOf(language, topicId), parseSentences(path, data))
  }

  const getSentences = (language: LanguageCode, topicId: string) => [
    ...(sentencesByKey.get(keyOf(language, topicId)) ?? []),
  ]

  return {
    getLanguages: () => [...LANGUAGES],
    getTopics: (pair) =>
      TOPICS.filter((topic) => pair.every((language) => getSentences(language, topic.id).length > 0)),
    getSentences,
  }
}

export const staticSource = createStaticSource(
  import.meta.glob('./data/*/*.json', { eager: true, import: 'default' }),
)
