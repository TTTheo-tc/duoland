import { createHash } from 'node:crypto'
import { z } from 'zod'

export const AuthoringStateSchema = z.enum([
  'drafting',
  'generated',
  'auto_validating',
  'auto_validation_failed',
  'needs_ai_refinement',
  'needs_expert_review',
  'expert_changes_requested',
  'approved',
  'published',
  'archived'
])

export const SelContentIssueTypeSchema = z.enum([
  'multiple_acceptable_responses',
  'no_safe_response_option',
  'incorrect_feedback',
  'developmentally_inappropriate',
  'emotion_invalidating',
  'overly_diagnostic',
  'therapy_or_medical_advice',
  'unsafe_crisis_handling',
  'culturally_inappropriate',
  'parent_teacher_guidance_mismatch',
  'guardian_teacher_mismatch',
  'ambiguous_scenario',
  'excessive_blame_on_child',
  'privacy_sensitive_prompt'
])

export const ContentIssueSeveritySchema = z.enum(['minor', 'major', 'critical'])

export const ContentIssueSchema = z.object({
  id: z.string().min(1),
  severity: ContentIssueSeveritySchema,
  type: SelContentIssueTypeSchema,
  location: z.object({
    questId: z.string().min(1),
    stageId: z.string().min(1).optional(),
    activityId: z.string().min(1).optional(),
    fieldPath: z.string().min(1).optional()
  }),
  explanation: z.string().min(1),
  suggestedFix: z.string().min(1).optional(),
  blocksPublishing: z.boolean()
})

export const ValidationRunSchema = z.object({
  id: z.string().min(1),
  validatorId: z.string().min(1),
  validatorType: z.enum(['rule', 'llm', 'expert', 'manual']),
  status: z.enum(['passed', 'flagged', 'failed']),
  model: z.string().min(1).optional(),
  startedAt: z.string().min(1),
  completedAt: z.string().min(1).optional(),
  summary: z.string().min(1).optional()
})

export const ContentValidationReportSchema = z.object({
  id: z.string().min(1),
  contentItemId: z.string().min(1),
  contentVersion: z.string().min(1),
  contentHash: z.string().min(1),
  status: z.enum([
    'passed',
    'needs_minor_revision',
    'needs_major_revision',
    'blocked'
  ]),
  validators: z.array(ValidationRunSchema).min(1),
  issues: z.array(ContentIssueSchema),
  summary: z.object({
    overallRisk: z.enum(['low', 'medium', 'high', 'critical']),
    pedagogicalQuality: z.enum(['poor', 'acceptable', 'good', 'excellent']),
    ageAppropriateness: z.enum([
      'not_appropriate',
      'borderline',
      'appropriate'
    ]),
    safetyDecision: z.enum(['allow', 'revise', 'block'])
  }),
  createdAt: z.string().min(1)
})

export const ExpertReviewerRoleSchema = z.enum([
  'child_development_psychologist',
  'school_mental_health_teacher',
  'sel_curriculum_designer',
  'safety_reviewer',
  'guardian_representative',
  'other'
])

export const ExpertReviewDecisionSchema = z.enum([
  'approved',
  'changes_requested',
  'rejected'
])

export const ContentExpertReviewSchema = z.object({
  id: z.string().min(1),
  contentItemId: z.string().min(1),
  contentVersion: z.string().min(1),
  contentHash: z.string().min(1),
  reviewer: z.object({
    id: z.string().min(1),
    displayName: z.string().min(1).optional(),
    role: ExpertReviewerRoleSchema
  }),
  decision: ExpertReviewDecisionSchema,
  reviewedIssueIds: z.array(z.string().min(1)).default([]),
  notes: z.array(z.string().min(1)).default([]),
  requiredFollowUps: z.array(z.string().min(1)).default([]),
  createdAt: z.string().min(1)
})

const ReviewableJsonObjectSchema = z.record(z.unknown())

export const ContentReviewPacketSchema = z.object({
  id: z.string().min(1),
  contentItemId: z.string().min(1),
  contentVersion: z.string().min(1),
  contentHash: z.string().min(1),
  generatedAt: z.string().min(1),
  questSummary: z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    subtitle: z.string().min(1).optional(),
    description: z.string().min(1),
    domain: z.string().min(1),
    ageBand: z.string().min(1),
    estimatedMinutes: z.number().int().positive(),
    learningObjectives: z.array(z.string().min(1))
  }),
  reviewableContent: z.object({
    title: z.string().min(1),
    subtitle: z.string().min(1).optional(),
    description: z.string().min(1),
    domain: z.string().min(1),
    ageBand: z.string().min(1),
    estimatedMinutes: z.number().int().positive(),
    learningObjectives: z.array(z.string().min(1)),
    safety: ReviewableJsonObjectSchema,
    guardianSummary: ReviewableJsonObjectSchema,
    teacherGuide: ReviewableJsonObjectSchema.optional(),
    stages: z.array(ReviewableJsonObjectSchema),
    activities: z.array(ReviewableJsonObjectSchema),
    assets: z.array(ReviewableJsonObjectSchema)
  }),
  validation: z.object({
    reportId: z.string().min(1),
    status: z.enum([
      'passed',
      'needs_minor_revision',
      'needs_major_revision',
      'blocked'
    ]),
    summary: ContentValidationReportSchema.shape.summary,
    issueCount: z.number().int().nonnegative(),
    blockingIssueCount: z.number().int().nonnegative(),
    issues: z.array(ContentIssueSchema)
  }),
  existingReviews: z.array(
    z.object({
      id: z.string().min(1),
      reviewer: ContentExpertReviewSchema.shape.reviewer,
      decision: ExpertReviewDecisionSchema,
      requiredFollowUpCount: z.number().int().nonnegative(),
      createdAt: z.string().min(1)
    })
  ),
  reviewerChecklist: z.array(z.string().min(1)).min(1),
  reviewTemplate: ContentExpertReviewSchema
})

export const ContentRevisionPacketSchema = z.object({
  id: z.string().min(1),
  contentItemId: z.string().min(1),
  contentVersion: z.string().min(1),
  contentHash: z.string().min(1),
  generatedAt: z.string().min(1),
  source: z.enum(['validation', 'expert_review', 'mixed', 'none']),
  questSummary: z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    status: z.string().min(1),
    ageBand: z.string().min(1),
    learningObjectives: z.array(z.string().min(1))
  }),
  validation: z.object({
    reportId: z.string().min(1),
    status: z.enum([
      'passed',
      'needs_minor_revision',
      'needs_major_revision',
      'blocked'
    ]),
    summary: ContentValidationReportSchema.shape.summary,
    issues: z.array(ContentIssueSchema)
  }),
  expertFollowUps: z.array(
    z.object({
      reviewId: z.string().min(1),
      reviewer: ContentExpertReviewSchema.shape.reviewer,
      decision: ExpertReviewDecisionSchema,
      notes: z.array(z.string().min(1)),
      requiredFollowUps: z.array(z.string().min(1))
    })
  ),
  revisionTargetCount: z.number().int().nonnegative(),
  refinementConstraints: z.array(z.string().min(1)).min(1)
})

export const ArchivedContentExpertReviewSchema = z.object({
  archivedAt: z.string().min(1),
  reason: z.enum(['content_hash_changed']),
  currentContentHash: z.string().min(1),
  review: ContentExpertReviewSchema
})

export type AuthoringState = z.infer<typeof AuthoringStateSchema>
export type SelContentIssueType = z.infer<typeof SelContentIssueTypeSchema>
export type ContentIssueSeverity = z.infer<typeof ContentIssueSeveritySchema>
export type ContentIssue = z.infer<typeof ContentIssueSchema>
export type ValidationRun = z.infer<typeof ValidationRunSchema>
export type ContentValidationReport = z.infer<
  typeof ContentValidationReportSchema
>
export type ExpertReviewerRole = z.infer<typeof ExpertReviewerRoleSchema>
export type ExpertReviewDecision = z.infer<typeof ExpertReviewDecisionSchema>
export type ContentExpertReview = z.infer<typeof ContentExpertReviewSchema>
export type ContentReviewPacket = z.infer<typeof ContentReviewPacketSchema>
export type ContentRevisionPacket = z.infer<typeof ContentRevisionPacketSchema>
export type ArchivedContentExpertReview = z.infer<
  typeof ArchivedContentExpertReviewSchema
>

export class ContentPublishabilityError extends Error {
  reasons: string[]

  constructor(reasons: string[]) {
    super('Content is not publishable')
    this.reasons = reasons
  }
}

export function validateContentValidationReport(
  input: unknown
): ContentValidationReport {
  return ContentValidationReportSchema.parse(input)
}

export function validateContentExpertReview(input: unknown): ContentExpertReview {
  return ContentExpertReviewSchema.parse(input)
}

export function validateContentReviewPacket(input: unknown): ContentReviewPacket {
  return ContentReviewPacketSchema.parse(input)
}

export function validateContentRevisionPacket(input: unknown): ContentRevisionPacket {
  return ContentRevisionPacketSchema.parse(input)
}

export function validateArchivedContentExpertReview(
  input: unknown
): ArchivedContentExpertReview {
  return ArchivedContentExpertReviewSchema.parse(input)
}

export function hasBlockingIssues(report: ContentValidationReport) {
  return report.issues.some((issue) => issue.blocksPublishing)
}

export function isContentReportPublishable(
  report: ContentValidationReport,
  options: { expectedContentHash?: string } = {}
) {
  return getContentPublishabilityReasons(report, options).length === 0
}

export function assertContentReportPublishable(
  report: ContentValidationReport,
  options: { expectedContentHash?: string } = {}
) {
  const reasons = getContentPublishabilityReasons(report, options)
  if (reasons.length > 0) {
    throw new ContentPublishabilityError(reasons)
  }
}

export function getContentPublishabilityReasons(
  report: ContentValidationReport,
  options: { expectedContentHash?: string } = {}
) {
  const reasons: string[] = []

  if (
    options.expectedContentHash &&
    report.contentHash !== options.expectedContentHash
  ) {
    reasons.push('validation report content hash does not match quest content hash')
  }

  if (report.status !== 'passed') {
    reasons.push(`validation status is ${report.status}`)
  }

  if (hasBlockingIssues(report)) {
    reasons.push('validation report contains blocking issues')
  }

  if (report.summary.safetyDecision !== 'allow') {
    reasons.push(`safety decision is ${report.summary.safetyDecision}`)
  }

  if (report.summary.overallRisk !== 'low') {
    reasons.push(`overall risk is ${report.summary.overallRisk}`)
  }

  if (report.summary.ageAppropriateness !== 'appropriate') {
    reasons.push(
      `age appropriateness is ${report.summary.ageAppropriateness}`
    )
  }

  return reasons
}

export function isExpertReviewPublishable(input: {
  contentItemId: string
  contentVersion: string
  expectedContentHash?: string
  reviews: ContentExpertReview[]
}) {
  return getExpertReviewPublishabilityReasons(input).length === 0
}

export function getExpertReviewPublishabilityReasons(input: {
  contentItemId: string
  contentVersion: string
  expectedContentHash?: string
  reviews: ContentExpertReview[]
}) {
  const versionMatchedReviews = input.reviews.filter(
    (review) =>
      review.contentItemId === input.contentItemId &&
      review.contentVersion === input.contentVersion
  )
  const matchingReviews = input.expectedContentHash
    ? versionMatchedReviews.filter(
        (review) => review.contentHash === input.expectedContentHash
      )
    : versionMatchedReviews
  const reasons: string[] = []

  if (input.expectedContentHash) {
    for (const review of versionMatchedReviews) {
      if (review.contentHash !== input.expectedContentHash) {
        reasons.push(
          `expert review ${review.id} content hash does not match quest content hash`
        )
      }
    }
  }

  if (!matchingReviews.some((review) => review.decision === 'approved')) {
    reasons.push('missing expert approval')
  }

  for (const review of matchingReviews) {
    if (review.decision !== 'approved') {
      reasons.push(`expert review ${review.id} is ${review.decision}`)
    }

    if (review.requiredFollowUps.length > 0) {
      reasons.push(`expert review ${review.id} has required follow-ups`)
    }
  }

  return reasons
}

export function createContentHash(
  value: unknown,
  options: { omitTopLevelKeys?: string[] } = {}
) {
  const canonical = stableStringify(omitTopLevelKeys(value, options.omitTopLevelKeys))
  return `sha256_${createHash('sha256').update(canonical).digest('hex')}`
}

function omitTopLevelKeys(value: unknown, keys: string[] | undefined) {
  if (!keys?.length || !value || typeof value !== 'object' || Array.isArray(value)) {
    return value
  }

  const omittedKeys = new Set(keys)
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !omittedKeys.has(key))
  )
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`
}
