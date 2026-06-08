import { getQuestEntryBySlug, quests, toQuestSummary } from './registry'

export function listPreviewQuests() {
  return quests.map((quest) => toQuestSummary(quest))
}

export function getPreviewQuestBySlug(slug: string) {
  return getQuestEntryBySlug(slug)?.quest ?? null
}
