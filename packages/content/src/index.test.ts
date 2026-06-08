import { describe, expect, it } from 'vitest'
import {
  assertQuestPublishable,
  assertContentEvidence,
  auditContentEvidence,
  getQuestAuthoringSnapshot,
  getQuestArchivedExpertReviews,
  getQuestExpertReviews,
  getQuestPublishabilityReasons,
  getQuestValidationReport,
  isQuestPublishable,
  listPublishableQuests
} from './index'
import { listPreviewQuests } from './preview'

describe('content package publishability gates', () => {
  it('keeps local draft quests available for preview', () => {
    expect(listPreviewQuests().map((quest) => quest.slug)).toContain(
      'emotion-detective'
    )
  })

  it('loads a persisted validation report for the local quest', () => {
    const report = getQuestValidationReport('emotion-detective')

    expect(report?.id).toBe('report_emotion-detective_1.0.0_rules')
    expect(report?.status).toBe('passed')
    expect(report?.summary.safetyDecision).toBe('allow')
  })

  it('tracks expert reviews separately from automated validation', () => {
    expect(getQuestExpertReviews('emotion-detective')).toEqual([])
  })

  it('loads archived expert review history without counting it as current approval', () => {
    expect(getQuestArchivedExpertReviews('emotion-detective')).toEqual([])
    expect(getQuestPublishabilityReasons('emotion-detective')).toContain(
      'missing expert approval'
    )
  })

  it('derives an authoring state for the local quest', () => {
    const snapshot = getQuestAuthoringSnapshot('emotion-detective')
    const report = getQuestValidationReport('emotion-detective')

    expect(snapshot?.state).toBe('needs_expert_review')
    expect(snapshot?.contentHash).toBe(report?.contentHash)
    expect(snapshot?.publishabilityReasons).toEqual([
      'quest status is draft',
      'missing expert approval'
    ])
  })

  it('does not list draft quests as publishable', () => {
    expect(isQuestPublishable('emotion-detective')).toBe(false)
    expect(listPublishableQuests()).toEqual([])
    expect(getQuestPublishabilityReasons('emotion-detective')).toEqual([
      'quest status is draft',
      'missing expert approval'
    ])
    expect(() => assertQuestPublishable('emotion-detective')).toThrow()
  })

  it('has internally consistent persisted content evidence', () => {
    expect(auditContentEvidence()).toEqual([])
    expect(() => assertContentEvidence()).not.toThrow()
  })
})
