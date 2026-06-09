import type { ContentIssueSeverity, SelContentIssueType } from '@sel-quest/review-core'

export type ValidatorGoldCaseMutation =
  | 'none'
  | 'scenario_without_safe_choice'
  | 'diagnostic_child_feedback'
  | 'crisis_without_teacher_risk_notes'
  | 'quest_allows_free_text'
  | 'activity_allows_free_text'
  | 'emotion_invalidating_feedback'
  | 'privacy_request_text'
  | 'missing_teacher_guide'
  | 'unsafe_learning_objective'
  | 'emotion_card_without_acceptable_emotions'
  | 'legacy_correct_emotion_ids'

export interface ValidatorGoldCase {
  id: string
  title: string
  mutation: ValidatorGoldCaseMutation
  expectedIssueTypes: SelContentIssueType[]
  expectedFieldPaths?: string[]
  expectedSeverity?: ContentIssueSeverity
  allowAdditionalIssues?: boolean
}

export interface ValidatorCaseResult {
  case: ValidatorGoldCase
  actualIssueTypes: SelContentIssueType[]
  actualSeverities: ContentIssueSeverity[]
  actualFieldPaths: string[]
  passed: boolean
  missingIssueTypes: SelContentIssueType[]
  missingFieldPaths: string[]
  unexpectedIssueTypes: SelContentIssueType[]
  expectedSeverityMet: boolean
}

export interface ValidatorEvaluationSummary {
  totalCases: number
  passedCases: number
  failedCases: number
  criticalExpectedCases: number
  criticalFalseNegatives: number
  majorExpectedCases: number
  majorDetectedCases: number
  majorRecall: number
}

export interface ValidatorEvaluationResult {
  summary: ValidatorEvaluationSummary
  caseResults: ValidatorCaseResult[]
}

export interface ValidatorEvaluationThresholds {
  maxCriticalFalseNegatives: number
  minMajorRecall: number
}
