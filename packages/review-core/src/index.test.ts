import { describe, expect, it } from 'vitest'
import {
  ContentPublishabilityError,
  assertContentReportPublishable,
  createContentHash,
  getExpertReviewPublishabilityReasons,
  isExpertReviewPublishable,
  isContentReportPublishable,
  validateContentReviewPacket,
  validateContentRevisionPacket,
  validateContentExpertReview,
  validateContentValidationReport,
  type ContentExpertReview,
  type ContentValidationReport
} from './index'

const baseReport: ContentValidationReport = {
  id: 'report_001',
  contentItemId: 'emotion-detective',
  contentVersion: '1.0.0',
  contentHash: 'sha256_test0001',
  status: 'passed',
  validators: [
    {
      id: 'run_001',
      validatorId: 'rule.sel_content_baseline',
      validatorType: 'rule',
      status: 'passed',
      startedAt: '2026-06-09T00:00:00.000Z',
      completedAt: '2026-06-09T00:00:00.000Z'
    }
  ],
  issues: [],
  summary: {
    overallRisk: 'low',
    pedagogicalQuality: 'good',
    ageAppropriateness: 'appropriate',
    safetyDecision: 'allow'
  },
  createdAt: '2026-06-09T00:00:00.000Z'
}

const approvedReview: ContentExpertReview = {
  id: 'expert_review_001',
  contentItemId: 'emotion-detective',
  contentVersion: '1.0.0',
  contentHash: 'sha256_test0001',
  reviewer: {
    id: 'reviewer_001',
    role: 'child_development_psychologist'
  },
  decision: 'approved',
  reviewedIssueIds: [],
  reviewCoverage: {
    reviewedSections: [
      'child_content',
      'guardian_summary',
      'teacher_guide',
      'safety_policy',
      'activity_feedback'
    ]
  },
  notes: ['Approved for structured SEL preview content.'],
  requiredFollowUps: [],
  createdAt: '2026-06-09T00:00:00.000Z'
}

const requiredApprovalReviews: ContentExpertReview[] = [
  {
    ...approvedReview,
    id: 'expert_review_teacher_001',
    reviewer: {
      id: 'reviewer_teacher_001',
      role: 'school_mental_health_teacher'
    }
  },
  {
    ...approvedReview,
    id: 'expert_review_safety_001',
    reviewer: {
      id: 'reviewer_safety_001',
      role: 'safety_reviewer'
    }
  }
]

const reviewableLearningObjective = {
  id: 'lo_emotion_recognition',
  title: 'Recognize feelings',
  childFacingText: 'I can name how a character may feel.',
  selCompetencies: ['self_awareness'],
  safe: {
    sequenced: true,
    active: true,
    focused: true,
    explicit: true
  }
}

describe('review-core', () => {
  it('creates a stable content hash independent of object key order', () => {
    expect(createContentHash({ a: 1, b: ['x', 'y'] })).toBe(
      createContentHash({ b: ['x', 'y'], a: 1 })
    )
  })

  it('can omit top-level lifecycle fields from content hashes', () => {
    expect(
      createContentHash(
        { id: 'quest', status: 'draft', title: 'Quest' },
        { omitTopLevelKeys: ['status'] }
      )
    ).toBe(
      createContentHash(
        { id: 'quest', status: 'published', title: 'Quest' },
        { omitTopLevelKeys: ['status'] }
      )
    )
  })

  it('validates a content validation report', () => {
    expect(validateContentValidationReport(baseReport)).toEqual(baseReport)
  })

  it('marks a clean passed report as publishable', () => {
    expect(isContentReportPublishable(baseReport)).toBe(true)
    expect(() => assertContentReportPublishable(baseReport)).not.toThrow()
  })

  it('rejects validation reports with a stale content hash', () => {
    expect(() =>
      assertContentReportPublishable(baseReport, {
        expectedContentHash: 'sha256_stale001'
      })
    ).toThrow(ContentPublishabilityError)
  })

  it('rejects reports with blocking issues', () => {
    const blockedReport: ContentValidationReport = {
      ...baseReport,
      status: 'blocked',
      issues: [
        {
          id: 'issue_001',
          severity: 'critical',
          type: 'unsafe_crisis_handling',
          location: { questId: 'emotion-detective' },
          explanation: 'The quest introduces a crisis scenario without a safe handoff.',
          blocksPublishing: true
        }
      ],
      summary: {
        ...baseReport.summary,
        overallRisk: 'critical',
        safetyDecision: 'block'
      }
    }

    expect(isContentReportPublishable(blockedReport)).toBe(false)
    expect(() => assertContentReportPublishable(blockedReport)).toThrow(
      ContentPublishabilityError
    )
  })

  it('validates an expert review', () => {
    expect(validateContentExpertReview(approvedReview)).toEqual(approvedReview)
  })

  it('requires structured learning objectives in review packets', () => {
    const packet = {
      id: 'packet_001',
      contentItemId: 'emotion-detective',
      contentVersion: '1.0.0',
      contentHash: 'sha256_test0001',
      generatedAt: '2026-06-09T00:00:00.000Z',
      questSummary: {
        slug: 'emotion-detective',
        title: 'Emotion Detective',
        description: 'Practice naming feelings.',
        domain: 'mental_health_education',
        ageBand: '8-10',
        estimatedMinutes: 10,
        learningObjectives: [reviewableLearningObjective]
      },
      reviewableContent: {
        title: 'Emotion Detective',
        description: 'Practice naming feelings.',
        domain: 'mental_health_education',
        ageBand: '8-10',
        estimatedMinutes: 10,
        learningObjectives: [reviewableLearningObjective],
        safety: {},
        guardianSummary: {},
        stages: [],
        activities: [],
        assets: []
      },
      validation: {
        reportId: baseReport.id,
        status: baseReport.status,
        summary: baseReport.summary,
        issueCount: 0,
        blockingIssueCount: 0,
        issues: []
      },
      existingReviews: [],
      reviewerChecklist: ['Check child-facing feedback.'],
      reviewTemplate: approvedReview
    }

    expect(validateContentReviewPacket(packet).questSummary.learningObjectives).toEqual([
      reviewableLearningObjective
    ])
    expect(() =>
      validateContentReviewPacket({
        ...packet,
        questSummary: {
          ...packet.questSummary,
          learningObjectives: [{}]
        }
      })
    ).toThrow()
  })

  it('requires structured learning objectives in revision packets', () => {
    const packet = {
      id: 'revision_packet_001',
      contentItemId: 'emotion-detective',
      contentVersion: '1.0.0',
      contentHash: 'sha256_test0001',
      generatedAt: '2026-06-09T00:00:00.000Z',
      source: 'none',
      questSummary: {
        slug: 'emotion-detective',
        title: 'Emotion Detective',
        status: 'draft',
        ageBand: '8-10',
        learningObjectives: [reviewableLearningObjective]
      },
      validation: {
        reportId: baseReport.id,
        status: baseReport.status,
        summary: baseReport.summary,
        issues: []
      },
      expertFollowUps: [],
      revisionTargetCount: 0,
      refinementConstraints: ['Keep child-facing language safe.']
    }

    expect(validateContentRevisionPacket(packet).questSummary.learningObjectives).toEqual([
      reviewableLearningObjective
    ])
    expect(() =>
      validateContentRevisionPacket({
        ...packet,
        questSummary: {
          ...packet.questSummary,
          learningObjectives: [{}]
        }
      })
    ).toThrow()
  })

  it('requires a matching expert approval policy for publishability', () => {
    expect(
      isExpertReviewPublishable({
        contentItemId: 'emotion-detective',
        contentVersion: '1.0.0',
        expectedContentHash: 'sha256_test0001',
        reviews: requiredApprovalReviews
      })
    ).toBe(true)

    expect(
      getExpertReviewPublishabilityReasons({
        contentItemId: 'emotion-detective',
        contentVersion: '1.0.0',
        expectedContentHash: 'sha256_test0001',
        reviews: []
      })
    ).toEqual([
      'missing expert approval',
      'requires at least 2 approved expert reviews',
      'requires at least 2 distinct approving reviewers',
      'missing required reviewer role school_mental_health_teacher',
      'missing required reviewer role safety_reviewer',
      'missing review coverage section child_content',
      'missing review coverage section guardian_summary',
      'missing review coverage section teacher_guide',
      'missing review coverage section safety_policy',
      'missing review coverage section activity_feedback'
    ])

    expect(
      getExpertReviewPublishabilityReasons({
        contentItemId: 'emotion-detective',
        contentVersion: '1.0.0',
        expectedContentHash: 'sha256_test0001',
        reviews: [approvedReview]
      })
    ).toEqual([
      'requires at least 2 approved expert reviews',
      'requires at least 2 distinct approving reviewers',
      'missing required reviewer role school_mental_health_teacher',
      'missing required reviewer role safety_reviewer'
    ])
  })

  it('requires approvals from distinct reviewers', () => {
    const sameReviewerApprovals = [
      {
        ...requiredApprovalReviews[0],
        reviewer: {
          id: 'reviewer_shared_001',
          role: 'school_mental_health_teacher' as const
        }
      },
      {
        ...requiredApprovalReviews[1],
        reviewer: {
          id: 'reviewer_shared_001',
          role: 'safety_reviewer' as const
        }
      }
    ]

    expect(
      getExpertReviewPublishabilityReasons({
        contentItemId: 'emotion-detective',
        contentVersion: '1.0.0',
        expectedContentHash: 'sha256_test0001',
        reviews: sameReviewerApprovals
      })
    ).toEqual(['requires at least 2 distinct approving reviewers'])
  })

  it('requires review coverage across approved reviews', () => {
    const missingCoverage = requiredApprovalReviews.map((review) => ({
      ...review,
      reviewCoverage: {
        reviewedSections: ['child_content' as const]
      }
    }))

    expect(
      getExpertReviewPublishabilityReasons({
        contentItemId: 'emotion-detective',
        contentVersion: '1.0.0',
        expectedContentHash: 'sha256_test0001',
        reviews: missingCoverage
      })
    ).toEqual([
      'missing review coverage section guardian_summary',
      'missing review coverage section teacher_guide',
      'missing review coverage section safety_policy',
      'missing review coverage section activity_feedback'
    ])
  })

  it('rejects expert reviews with required follow-ups', () => {
    const changesRequested: ContentExpertReview = {
      ...approvedReview,
      id: 'expert_review_002',
      decision: 'changes_requested',
      requiredFollowUps: ['Revise scenario feedback before publishing.']
    }

    expect(
      getExpertReviewPublishabilityReasons({
        contentItemId: 'emotion-detective',
        contentVersion: '1.0.0',
        expectedContentHash: 'sha256_test0001',
        reviews: [...requiredApprovalReviews, changesRequested]
      })
    ).toEqual([
      'expert review expert_review_002 is changes_requested',
      'expert review expert_review_002 has required follow-ups'
    ])
  })

  it('rejects expert reviews with a stale content hash', () => {
    expect(
      getExpertReviewPublishabilityReasons({
        contentItemId: 'emotion-detective',
        contentVersion: '1.0.0',
        expectedContentHash: 'sha256_current1',
        reviews: requiredApprovalReviews
      })
    ).toEqual([
      'expert review expert_review_teacher_001 content hash does not match quest content hash',
      'expert review expert_review_safety_001 content hash does not match quest content hash',
      'missing expert approval',
      'requires at least 2 approved expert reviews',
      'requires at least 2 distinct approving reviewers',
      'missing required reviewer role school_mental_health_teacher',
      'missing required reviewer role safety_reviewer',
      'missing review coverage section child_content',
      'missing review coverage section guardian_summary',
      'missing review coverage section teacher_guide',
      'missing review coverage section safety_policy',
      'missing review coverage section activity_feedback'
    ])
  })
})
