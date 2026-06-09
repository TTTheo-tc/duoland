import {
  validateQuestDefinition,
  type QuestDefinition
} from '@sel-quest/quest-core'
import {
  assertAssetManifestReference,
  assertWorldAssetReferences,
  validateAssetManifest,
  type AssetManifest
} from '@sel-quest/asset-pipeline'
import {
  assertNarrativeReferences,
  validateNarrativeDefinition,
  type NarrativeDefinition
} from '@sel-quest/narrative-core'
import {
  assertWorldBindingReference,
  validateWorldDefinition,
  type WorldDefinition
} from '@sel-quest/world-core'
import {
  validateArchivedContentExpertReview,
  validateContentExpertReview,
  validateContentValidationReport,
  type ArchivedContentExpertReview,
  type ContentExpertReview,
  type ContentValidationReport
} from '@sel-quest/review-core'
import emotionDetectiveQuest from './quests/emotion-detective/quest.json'
import emotionDetectiveWorld from './quests/emotion-detective/world.json'
import emotionDetectiveNarrative from './quests/emotion-detective/narrative.json'
import emotionDetectiveAssetManifest from './quests/emotion-detective/asset-manifest.json'
import emotionDetectiveValidationReport from './quests/emotion-detective/validation-report.json'
import emotionDetectiveExpertReviews from './quests/emotion-detective/expert-reviews.json'
import emotionDetectiveArchivedExpertReviews from './quests/emotion-detective/archived-expert-reviews.json'

export interface QuestEntry {
  quest: QuestDefinition
  world?: WorldDefinition
  narrative?: NarrativeDefinition
  assetManifest?: AssetManifest
  validationReport: ContentValidationReport
  expertReviews: ContentExpertReview[]
  archivedExpertReviews: ArchivedContentExpertReview[]
}

const emotionDetective = validateQuestDefinition(emotionDetectiveQuest)
const emotionDetectiveWorldDefinition = validateWorldDefinition(emotionDetectiveWorld)
const emotionDetectiveNarrativeDefinition = validateNarrativeDefinition(
  emotionDetectiveNarrative
)
const emotionDetectiveAssetManifestDefinition = validateAssetManifest(
  emotionDetectiveAssetManifest
)
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
  createQuestEntry({
    quest: emotionDetective,
    world: emotionDetectiveWorldDefinition,
    narrative: emotionDetectiveNarrativeDefinition,
    assetManifest: emotionDetectiveAssetManifestDefinition,
    validationReport: emotionDetectiveReport,
    expertReviews: emotionDetectiveReviews,
    archivedExpertReviews: emotionDetectiveArchivedReviews
  })
]

export const quests = questEntries.map((entry) => entry.quest)

export function getQuestEntryBySlug(slug: string): QuestEntry | null {
  return questEntries.find((entry) => entry.quest.slug === slug) ?? null
}

export function getQuestWorldBySlug(slug: string) {
  return getQuestEntryBySlug(slug)?.world ?? null
}

export function getQuestNarrativeBySlug(slug: string) {
  return getQuestEntryBySlug(slug)?.narrative ?? null
}

export function getQuestAssetManifestBySlug(slug: string) {
  return getQuestEntryBySlug(slug)?.assetManifest ?? null
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

function createQuestEntry(entry: QuestEntry): QuestEntry {
  if (entry.quest.worldBinding && !entry.world) {
    throw new Error(`Quest ${entry.quest.id} declares worldBinding without a world.`)
  }

  if (entry.quest.worldBinding && entry.world) {
    assertWorldBindingReference(entry.quest.worldBinding, entry.world)
    assertWorldActivityReferences(entry)
  }

  if (entry.world?.assetManifestId && !entry.assetManifest) {
    throw new Error(
      `World ${entry.world.id} declares assetManifestId without an asset manifest.`
    )
  }

  if (entry.assetManifest && !entry.world?.assetManifestId) {
    throw new Error(
      `Quest ${entry.quest.id} declares an asset manifest without world assetManifestId.`
    )
  }

  if (entry.world?.assetManifestId && entry.assetManifest) {
    assertAssetManifestReference(entry.assetManifest, entry.world.assetManifestId)
    assertWorldAssetReferences(entry.world, entry.assetManifest)
  }

  if (
    entry.quest.episodeIds &&
    entry.quest.episodeIds.length > 0 &&
    !entry.narrative
  ) {
    throw new Error(`Quest ${entry.quest.id} declares episodeIds without a narrative.`)
  }

  if (entry.narrative) {
    assertNarrativeReferences(entry.narrative, {
      questId: entry.quest.id,
      episodeIds: entry.quest.episodeIds,
      activityIds: entry.quest.activities.map((activity) => activity.id),
      learningObjectiveIds: entry.quest.learningObjectives.map(
        (objective) => objective.id
      ),
      worldZoneIds: entry.world?.zones.map((zone) => zone.id) ?? [],
      sceneIds: entry.world?.scenes.map((scene) => scene.id) ?? [],
      interactableIds:
        entry.world?.interactables.map((interactable) => interactable.id) ?? [],
      characterIds: entry.world?.characters.map((character) => character.id) ?? []
    })
  }

  return entry
}

export function assertWorldActivityReferences(entry: QuestEntry): void {
  if (!entry.world) return

  const activityIds = new Set(entry.quest.activities.map((activity) => activity.id))
  for (const interactable of entry.world.interactables) {
    for (const action of interactable.onInteract) {
      if (action.type === 'start_activity' && !activityIds.has(action.activityId)) {
        throw new Error(
          `World ${entry.world.id} interactable ${interactable.id} references unknown activity ${action.activityId}.`
        )
      }
    }
  }
}
