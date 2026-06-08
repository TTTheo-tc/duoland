import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { validateQuestDefinition } from '@sel-quest/quest-core'
import { auditAuthoringEvidence } from '@sel-quest/content-authoring'
import {
  validateContentExpertReview,
  validateContentValidationReport
} from '@sel-quest/review-core'
import {
  assertQuestDirectorySlug,
  assertValidQuestSlug,
  getPositionals,
  getQuestDir,
  getValidationReportDriftIssues,
  printValidationReportDrift
} from './script-utils.mjs'

const args = process.argv.slice(2)
const positionals = getPositionals(args)
const [slug, reviewPath] = positionals

if (!slug || !reviewPath) {
  console.error(
    'Usage: npm run content:record-review -- <quest-slug> <review-json-path>'
  )
  process.exit(1)
}

assertValidQuestSlug(slug)
const questDir = getQuestDir(slug)
const quest = validateQuestDefinition(
  JSON.parse(await readFile(path.join(questDir, 'quest.json'), 'utf8'))
)
assertQuestDirectorySlug(quest, slug)
const validationReport = validateContentValidationReport(
  JSON.parse(await readFile(path.join(questDir, 'validation-report.json'), 'utf8'))
)
const reviewsPath = path.join(questDir, 'expert-reviews.json')
const existingReviews = JSON.parse(await readFile(reviewsPath, 'utf8')).map((review) =>
  validateContentExpertReview(review)
)
const incomingReview = validateContentExpertReview(
  JSON.parse(await readFile(path.resolve(reviewPath), 'utf8'))
)

const evidenceIssues = auditAuthoringEvidence({
  quest,
  validationReport,
  expertReviews: existingReviews
})

if (evidenceIssues.length > 0) {
  console.error(`${slug}: content evidence audit failed`)
  for (const issue of evidenceIssues) {
    console.error(`- ${issue.code}: ${issue.message}`)
  }
  process.exit(1)
}

const driftIssues = getValidationReportDriftIssues(quest, validationReport)

if (driftIssues.length > 0) {
  printValidationReportDrift(slug, driftIssues)
  process.exit(1)
}

const reviewIssues = validateIncomingReview({
  quest,
  validationReport,
  existingReviews,
  incomingReview
})

if (reviewIssues.length > 0) {
  console.error(`${slug}: expert review was not recorded`)
  for (const issue of reviewIssues) {
    console.error(`- ${issue}`)
  }
  process.exit(1)
}

const nextReviews = [...existingReviews, incomingReview]
await writeFile(reviewsPath, `${JSON.stringify(nextReviews, null, 2)}\n`)
console.log(`${slug}: recorded expert review ${incomingReview.id}`)

function validateIncomingReview(input) {
  const issues = []

  if (input.existingReviews.some((review) => review.id === input.incomingReview.id)) {
    issues.push(`duplicate expert review id ${input.incomingReview.id}`)
  }

  if (input.incomingReview.contentItemId !== input.quest.id) {
    issues.push('expert review content id does not match quest id')
  }

  if (input.incomingReview.contentVersion !== input.quest.version) {
    issues.push('expert review version does not match quest version')
  }

  if (input.incomingReview.contentHash !== input.validationReport.contentHash) {
    issues.push('expert review content hash does not match current validation report')
  }

  if (input.incomingReview.reviewer.id === 'reviewer_id_here') {
    issues.push('expert review still contains the template reviewer id')
  }

  if (containsTemplateText(input.incomingReview.notes)) {
    issues.push('expert review notes still contain template placeholder text')
  }

  if (containsTemplateText(input.incomingReview.requiredFollowUps)) {
    issues.push('expert review follow-ups still contain template placeholder text')
  }

  return issues
}

function containsTemplateText(values) {
  return values.some((value) => /Replace this/i.test(value))
}
