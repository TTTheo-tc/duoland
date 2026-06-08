import { describe, expect, it } from 'vitest'
import {
  ContentPublishabilityError,
  assertContentReportPublishable,
  createContentHash,
  getExpertReviewPublishabilityReasons,
  isExpertReviewPublishable,
  isContentReportPublishable,
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
  notes: ['Approved for structured SEL preview content.'],
  requiredFollowUps: [],
  createdAt: '2026-06-09T00:00:00.000Z'
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

  it('requires a matching expert approval for publishability', () => {
    expect(
      isExpertReviewPublishable({
        contentItemId: 'emotion-detective',
        contentVersion: '1.0.0',
        expectedContentHash: 'sha256_test0001',
        reviews: [approvedReview]
      })
    ).toBe(true)

    expect(
      getExpertReviewPublishabilityReasons({
        contentItemId: 'emotion-detective',
        contentVersion: '1.0.0',
        expectedContentHash: 'sha256_test0001',
        reviews: []
      })
    ).toContain('missing expert approval')
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
        reviews: [approvedReview, changesRequested]
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
        reviews: [approvedReview]
      })
    ).toEqual([
      'expert review expert_review_001 content hash does not match quest content hash',
      'missing expert approval'
    ])
  })
})
