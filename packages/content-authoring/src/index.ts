import type { QuestDefinition } from '@sel-quest/quest-core'
import {
  createContentHash,
  getContentPublishabilityReasons,
  getExpertReviewPublishabilityReasons,
  isExpertReviewPublishable,
  type AuthoringState,
  type ContentExpertReview,
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
}): AuthoringSnapshot {
  const expertReviews = input.expertReviews ?? []
  const contentHash = createQuestContentHash(input.quest)
  const state = deriveAuthoringState({
    quest: input.quest,
    validationReport: input.validationReport,
    expertReviews
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
      expertReviews
    })
  }
}

export function deriveAuthoringState(input: {
  quest: QuestDefinition
  validationReport?: ContentValidationReport | null
  expertReviews?: ContentExpertReview[]
}): AuthoringState {
  if (input.quest.status === 'archived') return 'archived'
  if (!input.validationReport) return 'drafting'

  if (!reportMatchesQuest(input.quest, input.validationReport)) {
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
    input.expertReviews ?? []
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
      expectedContentHash: createQuestContentHash(input.quest),
      reviews: matchingExpertReviews
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
}) {
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
      expectedContentHash: createQuestContentHash(input.quest)
    })
  )
  reasons.push(
    ...getExpertReviewPublishabilityReasons({
      contentItemId: input.quest.id,
      contentVersion: input.quest.version,
      expectedContentHash: createQuestContentHash(input.quest),
      reviews: input.expertReviews ?? []
    })
  )

  return reasons
}

export function auditAuthoringEvidence(input: {
  quest: QuestDefinition
  validationReport?: ContentValidationReport | null
  expertReviews?: ContentExpertReview[]
}): AuthoringEvidenceIssue[] {
  const contentHash = createQuestContentHash(input.quest)
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
  report: ContentValidationReport
) {
  return (
    report.contentItemId === quest.id &&
    report.contentVersion === quest.version &&
    report.contentHash === createQuestContentHash(quest)
  )
}

function getMatchingExpertReviews(
  quest: QuestDefinition,
  reviews: ContentExpertReview[]
) {
  return reviews.filter(
    (review) =>
      review.contentItemId === quest.id &&
      review.contentVersion === quest.version &&
      review.contentHash === createQuestContentHash(quest)
  )
}

function createQuestContentHash(quest: QuestDefinition) {
  return createContentHash(quest, { omitTopLevelKeys: ['status'] })
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
        message: 'Validation report content hash does not match quest content hash.',
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
        message: 'Expert review content hash does not match quest content hash.',
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
