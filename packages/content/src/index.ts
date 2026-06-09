import {
  auditAuthoringEvidence,
  createAuthoringSnapshot,
  getAuthoringPublishabilityReasons,
  type AuthoringEvidenceIssue
} from '@sel-quest/content-authoring'
import {
  ContentPublishabilityError
} from '@sel-quest/review-core'
import {
  getQuestEntryBySlug,
  getQuestNarrativeBySlug,
  getQuestWorldBySlug,
  questEntries,
  toQuestSummary
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
    expertReviews: entry.expertReviews
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
    expertReviews: entry.expertReviews
  })
}

export function auditContentEvidence(): AuthoringEvidenceIssue[] {
  return questEntries.flatMap((entry) =>
    auditAuthoringEvidence({
      quest: entry.quest,
      validationReport: entry.validationReport,
      expertReviews: entry.expertReviews
    })
  )
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
