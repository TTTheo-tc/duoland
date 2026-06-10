import type { QuestDefinition } from '@sel-quest/quest-core'
import {
  createContentHash,
  defaultContentReviewPolicy,
  getContentPublishabilityReasons,
  getExpertReviewPublishabilityReasons,
  isExpertReviewPublishable,
  type AuthoringState,
  type ContentExpertReview,
  type ContentReviewPolicy,
  type ContentValidationReport
} from '@sel-quest/review-core'

export interface QuestGenerationBrief {
  title: string
  domain: QuestDefinition['domain']
  ageBand: QuestDefinition['ageBand']
  learningObjectives: QuestDefinition['learningObjectives']
  sourceExampleQuestId?: string
  constraints?: string[]
}

export interface CandidateQuest {
  quest: QuestDefinition
  authoringState: AuthoringState
  provenance: {
    generatorId: string
    generatedAt: string
    sourceExampleQuestId?: string
  }
}

export interface ContentGenerator {
  generateQuest(input: QuestGenerationBrief): Promise<CandidateQuest>
}

export class DisabledContentGenerator implements ContentGenerator {
  generateQuest(): Promise<never> {
    return Promise.reject(
      new Error('AI content generation is disabled until an authoring service is injected.')
    )
  }
}

export interface AuthoringSnapshot {
  contentItemId: string
  contentVersion: string
  contentHash: string
  state: AuthoringState
  validationReport?: ContentValidationReport
  expertReviews: ContentExpertReview[]
  publishabilityReasons: string[]
}

export interface AuthoringReviewSurfaceInput {
  usesWorldNarrative?: boolean
  usesAssetRepresentation?: boolean
}

export interface ContentBundleHashInput {
  quest: QuestDefinition
  world?: unknown | null
  narrative?: unknown | null
  assetManifest?: unknown | null
}

export interface AuthoringEvidenceIssue {
  severity: 'error' | 'warning'
  code:
    | 'missing_validation_report'
    | 'validation_report_content_id_mismatch'
    | 'validation_report_version_mismatch'
    | 'validation_report_hash_mismatch'
    | 'expert_review_content_id_mismatch'
    | 'expert_review_version_mismatch'
    | 'expert_review_hash_mismatch'
    | 'published_content_not_publishable'
  message: string
  contentItemId: string
  contentVersion: string
  evidenceId?: string
}

export function createAuthoringSnapshot(input: {
  quest: QuestDefinition
  validationReport?: ContentValidationReport | null
  expertReviews?: ContentExpertReview[]
  reviewPolicy?: ContentReviewPolicy
  reviewSurface?: AuthoringReviewSurfaceInput
  expectedContentHash?: string
}): AuthoringSnapshot {
  const expertReviews = input.expertReviews ?? []
  const reviewPolicy =
    input.reviewPolicy ?? createContentReviewPolicy(input.reviewSurface)
  const contentHash = getExpectedContentHash(input)
  const state = deriveAuthoringState({
    quest: input.quest,
    validationReport: input.validationReport,
    expertReviews,
    reviewPolicy,
    expectedContentHash: contentHash
  })

  return {
    contentItemId: input.quest.id,
    contentVersion: input.quest.version,
    contentHash,
    state,
    validationReport: input.validationReport ?? undefined,
    expertReviews,
    publishabilityReasons: getAuthoringPublishabilityReasons({
      quest: input.quest,
      validationReport: input.validationReport,
      expertReviews,
      reviewPolicy,
      expectedContentHash: contentHash
    })
  }
}

export function deriveAuthoringState(input: {
  quest: QuestDefinition
  validationReport?: ContentValidationReport | null
  expertReviews?: ContentExpertReview[]
  reviewPolicy?: ContentReviewPolicy
  reviewSurface?: AuthoringReviewSurfaceInput
  expectedContentHash?: string
}): AuthoringState {
  const reviewPolicy =
    input.reviewPolicy ?? createContentReviewPolicy(input.reviewSurface)
  const expectedContentHash = getExpectedContentHash(input)

  if (input.quest.status === 'archived') return 'archived'
  if (!input.validationReport) return 'drafting'

  if (!reportMatchesQuest(input.quest, input.validationReport, expectedContentHash)) {
    return 'auto_validation_failed'
  }

  if (input.validationReport.status === 'blocked') {
    return 'auto_validation_failed'
  }

  if (input.validationReport.status !== 'passed') {
    return 'needs_ai_refinement'
  }

  const matchingExpertReviews = getMatchingExpertReviews(
    input.quest,
    input.expertReviews ?? [],
    expectedContentHash
  )

  if (matchingExpertReviews.length === 0) {
    return 'needs_expert_review'
  }

  if (
    matchingExpertReviews.some(
      (review) =>
        review.decision !== 'approved' || review.requiredFollowUps.length > 0
    )
  ) {
    return 'expert_changes_requested'
  }

  if (
    !isExpertReviewPublishable({
      contentItemId: input.quest.id,
      contentVersion: input.quest.version,
      expectedContentHash,
      reviews: matchingExpertReviews,
      policy: reviewPolicy
    })
  ) {
    return 'needs_expert_review'
  }

  return input.quest.status === 'published' ? 'published' : 'approved'
}

export function getAuthoringPublishabilityReasons(input: {
  quest: QuestDefinition
  validationReport?: ContentValidationReport | null
  expertReviews?: ContentExpertReview[]
  reviewPolicy?: ContentReviewPolicy
  reviewSurface?: AuthoringReviewSurfaceInput
  expectedContentHash?: string
}) {
  const reviewPolicy =
    input.reviewPolicy ?? createContentReviewPolicy(input.reviewSurface)
  const expectedContentHash = getExpectedContentHash(input)
  const reasons: string[] = []

  if (input.quest.status !== 'published') {
    reasons.push(`quest status is ${input.quest.status}`)
  }

  if (!input.validationReport) {
    reasons.push('missing validation report')
    return reasons
  }

  if (input.validationReport.contentItemId !== input.quest.id) {
    reasons.push('validation report content id does not match quest id')
  }

  if (input.validationReport.contentVersion !== input.quest.version) {
    reasons.push('validation report version does not match quest version')
  }

  reasons.push(
    ...getContentPublishabilityReasons(input.validationReport, {
      expectedContentHash
    })
  )
  reasons.push(
    ...getExpertReviewPublishabilityReasons({
      contentItemId: input.quest.id,
      contentVersion: input.quest.version,
      expectedContentHash,
      reviews: input.expertReviews ?? [],
      policy: reviewPolicy
    })
  )

  return reasons
}

export function createContentReviewPolicy(
  surface: AuthoringReviewSurfaceInput = {}
): ContentReviewPolicy {
  const requiredCoverageSections = [
    ...defaultContentReviewPolicy.requiredCoverageSections
  ]

  if (surface.usesWorldNarrative) {
    requiredCoverageSections.push('world_narrative')
  }

  if (surface.usesAssetRepresentation) {
    requiredCoverageSections.push('asset_representation')
  }

  return {
    minimumApprovalCount: defaultContentReviewPolicy.minimumApprovalCount,
    minimumDistinctReviewerCount:
      defaultContentReviewPolicy.minimumDistinctReviewerCount,
    requiredApprovingRoles: [...defaultContentReviewPolicy.requiredApprovingRoles],
    requiredCoverageSections: [...new Set(requiredCoverageSections)]
  }
}

export function auditAuthoringEvidence(input: {
  quest: QuestDefinition
  validationReport?: ContentValidationReport | null
  expertReviews?: ContentExpertReview[]
  reviewPolicy?: ContentReviewPolicy
  reviewSurface?: AuthoringReviewSurfaceInput
  expectedContentHash?: string
}): AuthoringEvidenceIssue[] {
  const contentHash = getExpectedContentHash(input)
  const issues: AuthoringEvidenceIssue[] = []

  if (!input.validationReport) {
    issues.push(
      createEvidenceIssue(input.quest, {
        code: 'missing_validation_report',
        message: 'Content is missing a persisted validation report.'
      })
    )
  } else {
    issues.push(
      ...auditValidationReport(input.quest, input.validationReport, contentHash)
    )
  }

  for (const review of input.expertReviews ?? []) {
    issues.push(...auditExpertReview(input.quest, review, contentHash))
  }

  if (input.quest.status === 'published') {
    const publishabilityReasons = getAuthoringPublishabilityReasons(input)
    if (publishabilityReasons.length > 0) {
      issues.push(
        createEvidenceIssue(input.quest, {
          code: 'published_content_not_publishable',
          message: `Published content is not publishable: ${publishabilityReasons.join('; ')}.`
        })
      )
    }
  }

  return issues
}

function reportMatchesQuest(
  quest: QuestDefinition,
  report: ContentValidationReport,
  expectedContentHash = createQuestContentHash(quest)
) {
  return (
    report.contentItemId === quest.id &&
    report.contentVersion === quest.version &&
    report.contentHash === expectedContentHash
  )
}

function getMatchingExpertReviews(
  quest: QuestDefinition,
  reviews: ContentExpertReview[],
  expectedContentHash = createQuestContentHash(quest)
) {
  return reviews.filter(
    (review) =>
      review.contentItemId === quest.id &&
      review.contentVersion === quest.version &&
      review.contentHash === expectedContentHash
  )
}

export function createQuestContentHash(quest: QuestDefinition) {
  return createContentHash(quest, { omitTopLevelKeys: ['status'] })
}

export function createContentBundleHash(input: ContentBundleHashInput) {
  const hasSupplementalContent =
    input.world != null || input.narrative != null || input.assetManifest != null

  if (!hasSupplementalContent) {
    return createQuestContentHash(input.quest)
  }

  const { status: _status, ...questContent } = input.quest

  return createContentHash({
    quest: questContent,
    world: input.world ?? null,
    narrative: input.narrative ?? null,
    assetManifest: input.assetManifest ?? null
  })
}

function getExpectedContentHash(input: {
  quest: QuestDefinition
  expectedContentHash?: string
}) {
  return input.expectedContentHash ?? createQuestContentHash(input.quest)
}

function auditValidationReport(
  quest: QuestDefinition,
  report: ContentValidationReport,
  contentHash: string
): AuthoringEvidenceIssue[] {
  const issues: AuthoringEvidenceIssue[] = []

  if (report.contentItemId !== quest.id) {
    issues.push(
      createEvidenceIssue(quest, {
        code: 'validation_report_content_id_mismatch',
        message: 'Validation report content id does not match quest id.',
        evidenceId: report.id
      })
    )
  }

  if (report.contentVersion !== quest.version) {
    issues.push(
      createEvidenceIssue(quest, {
        code: 'validation_report_version_mismatch',
        message: 'Validation report content version does not match quest version.',
        evidenceId: report.id
      })
    )
  }

  if (report.contentHash !== contentHash) {
    issues.push(
      createEvidenceIssue(quest, {
        code: 'validation_report_hash_mismatch',
        message: 'Validation report content hash does not match expected content hash.',
        evidenceId: report.id
      })
    )
  }

  return issues
}

function auditExpertReview(
  quest: QuestDefinition,
  review: ContentExpertReview,
  contentHash: string
): AuthoringEvidenceIssue[] {
  const issues: AuthoringEvidenceIssue[] = []

  if (review.contentItemId !== quest.id) {
    issues.push(
      createEvidenceIssue(quest, {
        code: 'expert_review_content_id_mismatch',
        message: 'Expert review content id does not match quest id.',
        evidenceId: review.id
      })
    )
  }

  if (review.contentVersion !== quest.version) {
    issues.push(
      createEvidenceIssue(quest, {
        code: 'expert_review_version_mismatch',
        message: 'Expert review content version does not match quest version.',
        evidenceId: review.id
      })
    )
  }

  if (review.contentHash !== contentHash) {
    issues.push(
      createEvidenceIssue(quest, {
        code: 'expert_review_hash_mismatch',
        message: 'Expert review content hash does not match expected content hash.',
        evidenceId: review.id
      })
    )
  }

  return issues
}

function createEvidenceIssue(
  quest: QuestDefinition,
  input: {
    code: AuthoringEvidenceIssue['code']
    message: string
    evidenceId?: string
  }
): AuthoringEvidenceIssue {
  return {
    severity: 'error',
    code: input.code,
    message: input.message,
    contentItemId: quest.id,
    contentVersion: quest.version,
    evidenceId: input.evidenceId
  }
}
