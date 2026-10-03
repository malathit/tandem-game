import type { ContentSource, LanguagePair } from '../content/types'

/** A topic is either a preset id (shown by its name) or text the players typed. */
export function topicName(source: ContentSource, pair: LanguagePair, topic: string): string {
  return source.getTopics(pair).find((t) => t.id === topic)?.name ?? topic
}
