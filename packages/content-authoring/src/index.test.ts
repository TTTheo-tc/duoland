import { describe, expect, it } from 'vitest'
import type { QuestDefinition } from '@sel-quest/quest-core'
import type {
  ContentExpertReview,
  ContentValidationReport
} from '@sel-quest/review-core'
import { createContentHash } from '@sel-quest/review-core'
import {
  auditAuthoringEvidence,
  createAuthoringSnapshot,
  deriveAuthoringState,
  getAuthoringPublishabilityReasons
} from './index'

const quest: QuestDefinition = {
  id: 'emotion-detective',
  slug: 'emotion-detective',
  version: '1.0.0',
  status: 'draft',
  title: 'Emotion Detective',
  description: 'Practice naming feelings.',
  domain: 'mental_health_education',
  ageBand: '8-10',
  estimatedMinutes: 10,
  learningObjectives: [
    {
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
  ],
  safety: {
    dataSensitivity: 'low',
    allowsFreeTextInput: false,
    requiresGuardianConsent: false,
    crisisHandlingRequired: false
  },
  guardianSummary: {
    title: 'Summary',
    description: 'Summary',
    whatChildWillPractice: ['Choice'],
    whatDataIsCollected: ['Progress']
  },
  stages: [{ id: 'complete', title: 'Complete', type: 'complete' }],
  activities: [],
  assets: []
}
const questHash = createContentHash(quest, { omitTopLevelKeys: ['status'] })

const passedReport: ContentValidationReport = {
  id: 'report_001',
  contentItemId: 'emotion-detective',
  contentVersion: '1.0.0',
  contentHash: questHash,
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
  id: 'review_001',
  contentItemId: 'emotion-detective',
  contentVersion: '1.0.0',
  contentHash: questHash,
  reviewer: {
    id: 'reviewer_001',
    role: 'sel_curriculum_designer'
  },
  decision: 'approved',
  reviewedIssueIds: [],
  notes: ['Approved.'],
  requiredFollowUps: [],
  createdAt: '2026-06-09T00:00:00.000Z'
}

describe('content-authoring', () => {
  it('treats quests without validation reports as drafting', () => {
    expect(deriveAuthoringState({ quest })).toBe('drafting')
  })

  it('routes passed automated validation to expert review', () => {
    expect(deriveAuthoringState({ quest, validationReport: passedReport })).toBe(
      'needs_expert_review'
    )
  })

  it('routes flagged validation reports to refinement', () => {
    expect(
      deriveAuthoringState({
        quest,
        validationReport: {
          ...passedReport,
          status: 'needs_major_revision',
          summary: {
            ...passedReport.summary,
            overallRisk: 'high',
            safetyDecision: 'revise'
          }
        }
      })
    ).toBe('needs_ai_refinement')
  })

  it('routes blocking validation reports to auto validation failure', () => {
    expect(
      deriveAuthoringState({
        quest,
        validationReport: {
          ...passedReport,
          status: 'blocked',
          summary: {
            ...passedReport.summary,
            overallRisk: 'critical',
            safetyDecision: 'block'
          }
        }
      })
    ).toBe('auto_validation_failed')
  })

  it('routes stale validation reports to auto validation failure', () => {
    expect(
      deriveAuthoringState({
        quest,
        validationReport: {
          ...passedReport,
          contentHash: 'sha256_stale001'
        }
      })
    ).toBe('auto_validation_failed')
  })

  it('routes expert follow-ups to expert changes requested', () => {
    expect(
      deriveAuthoringState({
        quest,
        validationReport: passedReport,
        expertReviews: [
          {
            ...approvedReview,
            decision: 'changes_requested',
            requiredFollowUps: ['Revise feedback copy.']
          }
        ]
      })
    ).toBe('expert_changes_requested')
  })

  it('marks approved draft content separately from published content', () => {
    expect(
      deriveAuthoringState({
        quest,
        validationReport: passedReport,
        expertReviews: [approvedReview]
      })
    ).toBe('approved')

    expect(
      deriveAuthoringState({
        quest: { ...quest, status: 'published' },
        validationReport: passedReport,
        expertReviews: [approvedReview]
      })
    ).toBe('published')
  })

  it('returns a compact authoring snapshot with publishability reasons', () => {
    const snapshot = createAuthoringSnapshot({
      quest,
      validationReport: passedReport,
      expertReviews: []
    })

    expect(snapshot.state).toBe('needs_expert_review')
    expect(snapshot.contentHash).toBe(questHash)
    expect(snapshot.publishabilityReasons).toEqual([
      'quest status is draft',
      'missing expert approval'
    ])
  })

  it('reports missing validation evidence before expert review evidence', () => {
    expect(getAuthoringPublishabilityReasons({ quest })).toEqual([
      'quest status is draft',
      'missing validation report'
    ])
  })

  it('does not fail evidence audit for a draft awaiting expert review', () => {
    expect(
      auditAuthoringEvidence({
        quest,
        validationReport: passedReport,
        expertReviews: []
      })
    ).toEqual([])
  })

  it('reports stale validation or expert review evidence', () => {
    const staleHash = 'sha256_stale001'

    expect(
      auditAuthoringEvidence({
        quest,
        validationReport: {
          ...passedReport,
          contentHash: staleHash
        },
        expertReviews: [
          {
            ...approvedReview,
            contentHash: staleHash
          }
        ]
      }).map((issue) => issue.code)
    ).toEqual([
      'validation_report_hash_mismatch',
      'expert_review_hash_mismatch'
    ])
  })

  it('reports published content that does not satisfy publishability', () => {
    expect(
      auditAuthoringEvidence({
        quest: { ...quest, status: 'published' },
        validationReport: passedReport,
        expertReviews: []
      }).map((issue) => issue.code)
    ).toEqual(['published_content_not_publishable'])
  })
})
