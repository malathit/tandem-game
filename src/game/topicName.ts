import type { ContentSource } from '../content/types'

/** A topic is either a preset id (shown by its name) or text the players typed. */
export function topicName(source: ContentSource, topic: string): string {
  return source.getTopics().find((t) => t.id === topic)?.name ?? topic
}
