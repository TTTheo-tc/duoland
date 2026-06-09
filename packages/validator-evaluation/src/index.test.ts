import { describe, expect, it } from 'vitest'
import { validateQuestDefinition } from '@sel-quest/quest-core'
import {
  ValidatorEvaluationError,
  assertValidatorEvaluationPassed,
  buildGoldQuest,
  evaluateValidatorGoldCases,
  parseValidatorGoldCase,
  validatorGoldCaseMutations,
  type ValidatorGoldCase
} from './index.ts'

const goldCases: ValidatorGoldCase[] = [
  {
    id: 'clean',
    title: 'Clean baseline',
    mutation: 'none',
    expectedIssueTypes: []
  },
  {
    id: 'critical_no_safe',
    title: 'Missing safe response',
    mutation: 'scenario_without_safe_choice',
    expectedIssueTypes: ['no_safe_response_option'],
    expectedSeverity: 'critical'
  },
  {
    id: 'major_privacy',
    title: 'Privacy request',
    mutation: 'privacy_request_text',
    expectedIssueTypes: ['privacy_sensitive_prompt'],
    expectedSeverity: 'major'
  }
]

describe('validator-evaluation', () => {
  it('evaluates validator gold cases against the baseline validator', () => {
    const result = evaluateValidatorGoldCases(goldCases)

    expect(result.summary).toMatchObject({
      totalCases: 3,
      passedCases: 3,
      failedCases: 0,
      criticalFalseNegatives: 0,
      majorRecall: 1
    })
    expect(() => assertValidatorEvaluationPassed(result)).not.toThrow()
  })

  it('fails when expected issues are not detected', () => {
    const result = evaluateValidatorGoldCases([
      {
        id: 'wrong_expectation',
        title: 'Wrong expectation',
        mutation: 'none',
        expectedIssueTypes: ['privacy_sensitive_prompt'],
        expectedSeverity: 'major'
      }
    ])

    expect(result.caseResults[0].passed).toBe(false)
    expect(() => assertValidatorEvaluationPassed(result)).toThrow(
      ValidatorEvaluationError
    )
  })

  it('fails when expected field paths are not detected', () => {
    const result = evaluateValidatorGoldCases([
      {
        id: 'activity_free_text',
        title: 'Activity free text',
        mutation: 'activity_allows_free_text',
        expectedIssueTypes: ['privacy_sensitive_prompt'],
        expectedFieldPaths: ['activities.missing.safety.allowsFreeTextInput'],
        expectedSeverity: 'major',
        allowAdditionalIssues: true
      }
    ])

    expect(result.caseResults[0]).toMatchObject({
      passed: false,
      missingFieldPaths: ['activities.missing.safety.allowsFreeTextInput']
    })
  })

  it('counts critical severity downgrades as critical false negatives', () => {
    const result = evaluateValidatorGoldCases([
      {
        id: 'severity_downgrade',
        title: 'Severity downgrade',
        mutation: 'legacy_correct_emotion_ids',
        expectedIssueTypes: ['ambiguous_scenario'],
        expectedSeverity: 'critical'
      }
    ])

    expect(result.summary.criticalFalseNegatives).toBe(1)
    expect(result.caseResults[0].expectedSeverityMet).toBe(false)
  })

  it('parses and validates gold case records', () => {
    expect(
      parseValidatorGoldCase({
        id: 'case_001',
        title: 'Case 001',
        mutation: 'legacy_correct_emotion_ids',
        expectedIssueTypes: ['ambiguous_scenario'],
        expectedFieldPaths: ['activities.emotion_001.config.correctEmotionIds'],
        expectedSeverity: 'minor'
      })
    ).toMatchObject({
      mutation: 'legacy_correct_emotion_ids',
      expectedFieldPaths: ['activities.emotion_001.config.correctEmotionIds']
    })

    expect(() =>
      parseValidatorGoldCase({
        id: 'bad_case',
        title: 'Bad Case',
        mutation: 'unknown',
        expectedIssueTypes: []
      })
    ).toThrow(/unknown mutation/)
  })

  it('builds valid quest definitions for every supported mutation', () => {
    for (const mutation of validatorGoldCaseMutations) {
      expect(validateQuestDefinition(buildGoldQuest(mutation)).id).toBe(
        'validator-gold-quest'
      )
    }
  })
})
