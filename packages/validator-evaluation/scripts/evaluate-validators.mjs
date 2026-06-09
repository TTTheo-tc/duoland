import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertValidatorEvaluationPassed,
  defaultValidatorEvaluationThresholds,
  evaluateValidatorGoldCases,
  parseValidatorGoldCase
} from '@sel-quest/validator-evaluation'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..', '..')
const goldRoot = process.env.VALIDATOR_GOLD_ROOT
  ? path.resolve(process.env.VALIDATOR_GOLD_ROOT)
  : path.join(repoRoot, 'datasets', 'gold')

try {
  const thresholds = {
    maxCriticalFalseNegatives: parseNonNegativeIntegerThreshold(
      'VALIDATOR_MAX_CRITICAL_FALSE_NEGATIVES',
      defaultValidatorEvaluationThresholds.maxCriticalFalseNegatives
    ),
    minMajorRecall: parseRecallThreshold(
      'VALIDATOR_MIN_MAJOR_RECALL',
      defaultValidatorEvaluationThresholds.minMajorRecall
    )
  }
  const goldCases = await readGoldCases(goldRoot)
  const result = evaluateValidatorGoldCases(goldCases)

  printSummary(result)
  assertValidatorEvaluationPassed(result, thresholds)
} catch (error) {
  if (error?.failures) {
    for (const failure of error.failures) {
      console.error(`- ${failure}`)
    }
    printFailedCases(error.result)
  } else {
    console.error(error?.message ?? String(error))
  }
  process.exitCode = 1
}

async function readGoldCases(root) {
  const entries = await readdir(root, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
    .map((entry) => path.join(root, entry.name))
    .sort()
  const cases = []

  for (const file of files) {
    const lines = (await readFile(file, 'utf8')).split('\n')
    for (const [index, line] of lines.entries()) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      try {
        cases.push(parseValidatorGoldCase(JSON.parse(trimmed)))
      } catch (error) {
        throw new Error(`${path.basename(file)}:${index + 1}: ${error.message}`)
      }
    }
  }

  if (cases.length === 0) {
    throw new Error(`no validator gold cases found in ${root}`)
  }

  return cases
}

function printSummary(result) {
  const { summary } = result
  console.log(
    [
      `validator gold cases: ${summary.passedCases}/${summary.totalCases} passed`,
      `critical false negatives: ${summary.criticalFalseNegatives}/${summary.criticalExpectedCases}`,
      `major recall: ${summary.majorRecall.toFixed(2)} (${summary.majorDetectedCases}/${summary.majorExpectedCases})`
    ].join('\n')
  )
}

function printFailedCases(result) {
  for (const caseResult of result.caseResults.filter((item) => !item.passed)) {
    console.error(
      [
        `case ${caseResult.case.id} failed`,
        `  expected: ${caseResult.case.expectedIssueTypes.join(', ') || '<none>'}`,
        `  actual: ${caseResult.actualIssueTypes.join(', ') || '<none>'}`,
        `  missing: ${caseResult.missingIssueTypes.join(', ') || '<none>'}`,
        `  missing field paths: ${caseResult.missingFieldPaths.join(', ') || '<none>'}`,
        `  expected severity met: ${caseResult.expectedSeverityMet}`,
        `  unexpected: ${caseResult.unexpectedIssueTypes.join(', ') || '<none>'}`
      ].join('\n')
    )
  }
}

function parseNonNegativeIntegerThreshold(name, fallback) {
  const raw = process.env[name]
  if (raw === undefined) return fallback

  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`)
  }

  return value
}

function parseRecallThreshold(name, fallback) {
  const raw = process.env[name]
  if (raw === undefined) return fallback

  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a number between 0 and 1`)
  }

  return value
}
