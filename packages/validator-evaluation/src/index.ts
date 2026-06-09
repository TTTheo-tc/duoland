import { validateSelQuestContent } from '@sel-quest/content-validation'
import { validateQuestDefinition } from '@sel-quest/quest-core'
import type { ContentIssueSeverity, SelContentIssueType } from '@sel-quest/review-core'
import { buildGoldQuest } from './fixtures.ts'
import type {
  ValidatorCaseResult,
  ValidatorEvaluationResult,
  ValidatorEvaluationSummary,
  ValidatorEvaluationThresholds,
  ValidatorGoldCase,
  ValidatorGoldCaseMutation
} from './types.ts'

export * from './types.ts'
export { baselineGoldQuest, buildGoldQuest } from './fixtures.ts'

export const validatorGoldCaseMutations: ValidatorGoldCaseMutation[] = [
  'none',
  'scenario_without_safe_choice',
  'diagnostic_child_feedback',
  'crisis_without_teacher_risk_notes',
  'quest_allows_free_text',
  'activity_allows_free_text',
  'emotion_invalidating_feedback',
  'privacy_request_text',
  'missing_teacher_guide',
  'unsafe_learning_objective',
  'emotion_card_without_acceptable_emotions',
  'legacy_correct_emotion_ids'
]

const knownMutations = new Set<ValidatorGoldCaseMutation>(
  validatorGoldCaseMutations
)

const severityRank: Record<ContentIssueSeverity, number> = {
  minor: 1,
  major: 2,
  critical: 3
}

export const defaultValidatorEvaluationThresholds: ValidatorEvaluationThresholds = {
  maxCriticalFalseNegatives: 0,
  minMajorRecall: 0.85
}

export function evaluateValidatorGoldCases(
  cases: ValidatorGoldCase[]
): ValidatorEvaluationResult {
  const caseResults = cases.map(evaluateCase)
  const summary = summarizeCaseResults(caseResults)

  return {
    summary,
    caseResults
  }
}

export function assertValidatorEvaluationPassed(
  result: ValidatorEvaluationResult,
  thresholds: ValidatorEvaluationThresholds = defaultValidatorEvaluationThresholds
): void {
  const failures: string[] = []

  if (
    result.summary.criticalFalseNegatives >
    thresholds.maxCriticalFalseNegatives
  ) {
    failures.push(
      `critical false negatives ${result.summary.criticalFalseNegatives} exceeds ${thresholds.maxCriticalFalseNegatives}`
    )
  }

  if (result.summary.majorRecall < thresholds.minMajorRecall) {
    failures.push(
      `major recall ${result.summary.majorRecall.toFixed(2)} is below ${thresholds.minMajorRecall.toFixed(2)}`
    )
  }

  const failedCases = result.caseResults.filter((caseResult) => !caseResult.passed)
  if (failedCases.length > 0) {
    failures.push(`${failedCases.length} gold case(s) failed exact expectations`)
  }

  if (failures.length > 0) {
    throw new ValidatorEvaluationError(failures, result)
  }
}

export function parseValidatorGoldCase(input: unknown): ValidatorGoldCase {
  if (!input || typeof input !== 'object') {
    throw new Error('gold case must be an object')
  }

  const record = input as Record<string, unknown>
  const mutation = record.mutation
  const expectedIssueTypes = record.expectedIssueTypes

  if (typeof record.id !== 'string' || record.id.length === 0) {
    throw new Error('gold case id must be a non-empty string')
  }

  if (typeof record.title !== 'string' || record.title.length === 0) {
    throw new Error(`gold case ${record.id} title must be a non-empty string`)
  }

  if (typeof mutation !== 'string' || !knownMutations.has(mutation as ValidatorGoldCaseMutation)) {
    throw new Error(`gold case ${record.id} has unknown mutation`)
  }

  if (!Array.isArray(expectedIssueTypes)) {
    throw new Error(`gold case ${record.id} expectedIssueTypes must be an array`)
  }

  if (expectedIssueTypes.some((issueType) => typeof issueType !== 'string')) {
    throw new Error(`gold case ${record.id} expectedIssueTypes must contain strings`)
  }

  if (
    record.expectedFieldPaths !== undefined &&
    !Array.isArray(record.expectedFieldPaths)
  ) {
    throw new Error(`gold case ${record.id} expectedFieldPaths must be an array`)
  }

  if (
    Array.isArray(record.expectedFieldPaths) &&
    record.expectedFieldPaths.some((fieldPath) => typeof fieldPath !== 'string')
  ) {
    throw new Error(`gold case ${record.id} expectedFieldPaths must contain strings`)
  }

  if (
    record.expectedSeverity !== undefined &&
    record.expectedSeverity !== 'minor' &&
    record.expectedSeverity !== 'major' &&
    record.expectedSeverity !== 'critical'
  ) {
    throw new Error(`gold case ${record.id} has invalid expectedSeverity`)
  }

  return {
    id: record.id,
    title: record.title,
    mutation: mutation as ValidatorGoldCaseMutation,
    expectedIssueTypes: expectedIssueTypes as SelContentIssueType[],
    expectedFieldPaths: record.expectedFieldPaths as string[] | undefined,
    expectedSeverity: record.expectedSeverity as ContentIssueSeverity | undefined,
    allowAdditionalIssues: record.allowAdditionalIssues === true
  }
}

function evaluateCase(goldCase: ValidatorGoldCase): ValidatorCaseResult {
  const quest = validateQuestDefinition(buildGoldQuest(goldCase.mutation))
  const report = validateSelQuestContent(quest, {
    now: () => '2026-06-09T00:00:00.000Z',
    reportId: `report_${goldCase.id}`
  })
  const actualIssueTypes = report.issues.map((issue) => issue.type)
  const actualSeverities = report.issues.map((issue) => issue.severity)
  const actualFieldPaths = report.issues.flatMap((issue) =>
    issue.location.fieldPath ? [issue.location.fieldPath] : []
  )
  const missingIssueTypes = goldCase.expectedIssueTypes.filter(
    (type) => !actualIssueTypes.includes(type)
  )
  const missingFieldPaths = (goldCase.expectedFieldPaths ?? []).filter(
    (fieldPath) => !actualFieldPaths.includes(fieldPath)
  )
  const unexpectedIssueTypes = goldCase.allowAdditionalIssues
    ? []
    : actualIssueTypes.filter(
        (type) => !goldCase.expectedIssueTypes.includes(type)
      )
  const severitySatisfied =
    !goldCase.expectedSeverity ||
    report.issues.some(
      (issue) =>
        goldCase.expectedIssueTypes.includes(issue.type) &&
        severityRank[issue.severity] >= severityRank[goldCase.expectedSeverity!]
    )
  const passed =
    missingIssueTypes.length === 0 &&
    missingFieldPaths.length === 0 &&
    unexpectedIssueTypes.length === 0 &&
    severitySatisfied

  return {
    case: goldCase,
    actualIssueTypes,
    actualSeverities,
    actualFieldPaths,
    passed,
    missingIssueTypes,
    missingFieldPaths,
    unexpectedIssueTypes,
    expectedSeverityMet: severitySatisfied
  }
}

function summarizeCaseResults(
  caseResults: ValidatorCaseResult[]
): ValidatorEvaluationSummary {
  const criticalExpectedCases = caseResults.filter(
    (result) => result.case.expectedSeverity === 'critical'
  )
  const majorExpectedCases = caseResults.filter(
    (result) => result.case.expectedSeverity === 'major'
  )
  const criticalFalseNegatives = criticalExpectedCases.filter(
    (result) =>
      result.missingIssueTypes.length > 0 || !result.expectedSeverityMet
  ).length
  const majorDetectedCases = majorExpectedCases.filter(
    (result) =>
      result.missingIssueTypes.length === 0 && result.expectedSeverityMet
  ).length

  return {
    totalCases: caseResults.length,
    passedCases: caseResults.filter((result) => result.passed).length,
    failedCases: caseResults.filter((result) => !result.passed).length,
    criticalExpectedCases: criticalExpectedCases.length,
    criticalFalseNegatives,
    majorExpectedCases: majorExpectedCases.length,
    majorDetectedCases,
    majorRecall:
      majorExpectedCases.length === 0
        ? 1
        : majorDetectedCases / majorExpectedCases.length
  }
}

export class ValidatorEvaluationError extends Error {
  failures: string[]
  result: ValidatorEvaluationResult

  constructor(failures: string[], result: ValidatorEvaluationResult) {
    super('Validator evaluation failed')
    this.failures = failures
    this.result = result
  }
}
