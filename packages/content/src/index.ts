import {
  auditAuthoringEvidence,
  createAuthoringSnapshot,
  createContentBundleHash,
  createContentReviewPolicy,
  getAuthoringPublishabilityReasons,
  type AuthoringEvidenceIssue,
  type AuthoringReviewSurfaceInput
} from '@sel-quest/content-authoring'
import {
  ContentPublishabilityError
} from '@sel-quest/review-core'
import {
  getQuestEntryBySlug,
  getQuestAssetManifestBySlug,
  getQuestNarrativeBySlug,
  getQuestWorldBySlug,
  questEntries,
  toQuestSummary,
  type QuestEntry
} from './registry'

export function listPublishableQuests() {
  return questEntries
    .filter((entry) => isQuestPublishable(entry.quest.slug))
    .map((entry) => toQuestSummary(entry.quest))
}

export function getPublishableQuestBySlug(slug: string) {
  const entry = getQuestEntryBySlug(slug)
  if (!entry || !isQuestPublishable(slug)) return null
  return entry.quest
}

export function getQuestValidationReport(slug: string) {
  return getQuestEntryBySlug(slug)?.validationReport ?? null
}

export { getQuestWorldBySlug }
export { getQuestNarrativeBySlug }
export { getQuestAssetManifestBySlug }

export function getQuestExpertReviews(slug: string) {
  return getQuestEntryBySlug(slug)?.expertReviews ?? []
}

export function getQuestArchivedExpertReviews(slug: string) {
  return getQuestEntryBySlug(slug)?.archivedExpertReviews ?? []
}

export function getQuestAuthoringSnapshot(slug: string) {
  const entry = getQuestEntryBySlug(slug)
  if (!entry) return null

  return createAuthoringSnapshot({
    quest: entry.quest,
    validationReport: entry.validationReport,
    expertReviews: entry.expertReviews,
    reviewSurface: getQuestReviewSurface(entry),
    expectedContentHash: getQuestEntryContentHash(entry)
  })
}

export function listAuthoringQuestSummaries() {
  return questEntries.map((entry) => {
    const reviewSurface = getQuestReviewSurface(entry)
    const reviewPolicy = createContentReviewPolicy(reviewSurface)
    const snapshot = createAuthoringSnapshot({
      quest: entry.quest,
      validationReport: entry.validationReport,
      expertReviews: entry.expertReviews,
      reviewPolicy,
      expectedContentHash: getQuestEntryContentHash(entry)
    })
    const currentApprovedReviews = entry.expertReviews.filter(
      (review) =>
        review.contentItemId === entry.quest.id &&
        review.contentVersion === entry.quest.version &&
        review.contentHash === snapshot.contentHash &&
        review.decision === 'approved' &&
        review.requiredFollowUps.length === 0
    )
    const presentCoverageSections = [
      ...new Set(
        currentApprovedReviews.flatMap(
          (review) => review.reviewCoverage.reviewedSections
        )
      )
    ].sort()
    const missingCoverageSections =
      reviewPolicy.requiredCoverageSections.filter(
        (section) => !presentCoverageSections.includes(section)
      )

    return {
      id: entry.quest.id,
      slug: entry.quest.slug,
      title: entry.quest.title,
      version: entry.quest.version,
      questStatus: entry.quest.status,
      authoringState: snapshot.state,
      validationStatus: entry.validationReport.status,
      validationIssueCount: entry.validationReport.issues.length,
      blockingIssueCount: entry.validationReport.issues.filter(
        (issue) => issue.blocksPublishing
      ).length,
      expertReviewCount: entry.expertReviews.length,
      approvedReviewCount: currentApprovedReviews.length,
      requiredApprovingRoles: reviewPolicy.requiredApprovingRoles,
      requiredCoverageSections: reviewPolicy.requiredCoverageSections,
      presentCoverageSections,
      missingCoverageSections,
      reviewSurface,
      publishabilityReasons: snapshot.publishabilityReasons
    }
  })
}

export function isQuestPublishable(slug: string) {
  return getQuestPublishabilityReasons(slug).length === 0
}

export function assertQuestPublishable(slug: string) {
  const reasons = getQuestPublishabilityReasons(slug)
  if (reasons.length > 0) {
    throw new ContentPublishabilityError(reasons)
  }
}

export function getQuestPublishabilityReasons(slug: string) {
  const entry = getQuestEntryBySlug(slug)
  if (!entry) return ['quest not found']

  return getAuthoringPublishabilityReasons({
    quest: entry.quest,
    validationReport: entry.validationReport,
    expertReviews: entry.expertReviews,
    reviewSurface: getQuestReviewSurface(entry),
    expectedContentHash: getQuestEntryContentHash(entry)
  })
}

export function auditContentEvidence(): AuthoringEvidenceIssue[] {
  return questEntries.flatMap((entry) =>
    auditAuthoringEvidence({
      quest: entry.quest,
      validationReport: entry.validationReport,
      expertReviews: entry.expertReviews,
      reviewSurface: getQuestReviewSurface(entry),
      expectedContentHash: getQuestEntryContentHash(entry)
    })
  )
}

function getQuestReviewSurface(entry: {
  world?: unknown
  narrative?: unknown
  assetManifest?: unknown
}): AuthoringReviewSurfaceInput {
  return {
    usesWorldNarrative: Boolean(entry.world || entry.narrative),
    usesAssetRepresentation: Boolean(entry.assetManifest)
  }
}

function getQuestEntryContentHash(entry: QuestEntry) {
  return createContentBundleHash({
    quest: entry.quest,
    world: entry.world,
    narrative: entry.narrative,
    assetManifest: entry.assetManifest
  })
}

export class ContentEvidenceAuditError extends Error {
  issues: AuthoringEvidenceIssue[]

  constructor(issues: AuthoringEvidenceIssue[]) {
    super('Content evidence audit failed')
    this.issues = issues
  }
}

export function assertContentEvidence() {
  const issues = auditContentEvidence()
  if (issues.length > 0) {
    throw new ContentEvidenceAuditError(issues)
  }
}
