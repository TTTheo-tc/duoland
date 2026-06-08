import {
  validateQuestDefinition,
  type QuestDefinition
} from '@sel-quest/quest-core'
import {
  validateArchivedContentExpertReview,
  validateContentExpertReview,
  validateContentValidationReport,
  type ArchivedContentExpertReview,
  type ContentExpertReview,
  type ContentValidationReport
} from '@sel-quest/review-core'
import emotionDetectiveQuest from './quests/emotion-detective/quest.json'
import emotionDetectiveValidationReport from './quests/emotion-detective/validation-report.json'
import emotionDetectiveExpertReviews from './quests/emotion-detective/expert-reviews.json'
import emotionDetectiveArchivedExpertReviews from './quests/emotion-detective/archived-expert-reviews.json'

export interface QuestEntry {
  quest: QuestDefinition
  validationReport: ContentValidationReport
  expertReviews: ContentExpertReview[]
  archivedExpertReviews: ArchivedContentExpertReview[]
}

const emotionDetective = validateQuestDefinition(emotionDetectiveQuest)
const emotionDetectiveReport = validateContentValidationReport(
  emotionDetectiveValidationReport
)
const emotionDetectiveReviews = emotionDetectiveExpertReviews.map((review) =>
  validateContentExpertReview(review)
)
const emotionDetectiveArchivedReviews = emotionDetectiveArchivedExpertReviews.map(
  (review) => validateArchivedContentExpertReview(review)
)

export const questEntries: QuestEntry[] = [
  {
    quest: emotionDetective,
    validationReport: emotionDetectiveReport,
    expertReviews: emotionDetectiveReviews,
    archivedExpertReviews: emotionDetectiveArchivedReviews
  }
]

export const quests = questEntries.map((entry) => entry.quest)

export function getQuestEntryBySlug(slug: string): QuestEntry | null {
  return questEntries.find((entry) => entry.quest.slug === slug) ?? null
}

export function toQuestSummary(quest: QuestDefinition) {
  return {
    id: quest.id,
    slug: quest.slug,
    title: quest.title,
    subtitle: quest.subtitle,
    description: quest.description,
    estimatedMinutes: quest.estimatedMinutes,
    ageBand: quest.ageBand
  }
}
