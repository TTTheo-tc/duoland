import { validateQuestDefinition } from '@sel-quest/quest-core'
import emotionDetectiveQuest from './quests/emotion-detective/quest.json'

const quests = [validateQuestDefinition(emotionDetectiveQuest)]

export function listQuests() {
  return quests.map((quest) => ({
    id: quest.id,
    slug: quest.slug,
    title: quest.title,
    subtitle: quest.subtitle,
    description: quest.description,
    estimatedMinutes: quest.estimatedMinutes,
    ageBand: quest.ageBand
  }))
}

export function getQuestBySlug(slug: string) {
  return quests.find((quest) => quest.slug === slug) ?? null
}

export { quests }
