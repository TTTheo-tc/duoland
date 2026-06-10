import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { validateQuestDefinition } from '@sel-quest/quest-core'
import { auditAuthoringEvidence } from '@sel-quest/content-authoring'
import {
  validateContentExpertReview,
  validateContentRevisionPacket,
  validateContentValidationReport
} from '@sel-quest/review-core'
import {
  assertQuestDirectorySlug,
  getContentBundleHash,
  getQuestDir,
  getQuestSlugArg,
  getValidationReportDriftIssues,
  printValidationReportDrift,
  readSupplementalContentJson
} from './script-utils.mjs'

const args = process.argv.slice(2)
const slug = getQuestSlugArg(
  args,
  'Usage: npm run content:revision-packet -- <quest-slug> [--out <path>]'
)
const outPath = getOptionValue('--out')

if (args.includes('--out') && !outPath) {
  console.error('--out requires a file path')
  process.exit(1)
}

const questDir = getQuestDir(slug)
const quest = validateQuestDefinition(
  JSON.parse(await readFile(path.join(questDir, 'quest.json'), 'utf8'))
)
assertQuestDirectorySlug(quest, slug)
const validationReport = validateContentValidationReport(
  JSON.parse(await readFile(path.join(questDir, 'validation-report.json'), 'utf8'))
)
const expertReviews = JSON.parse(
  await readFile(path.join(questDir, 'expert-reviews.json'), 'utf8')
).map((review) => validateContentExpertReview(review))
const supplementalContent = await readSupplementalContentJson(questDir)
const expectedContentHash = getContentBundleHash(quest, supplementalContent)

const driftIssues = getValidationReportDriftIssues(
  quest,
  validationReport,
  supplementalContent
)

if (driftIssues.length > 0) {
  printValidationReportDrift(slug, driftIssues)
  process.exit(1)
}

const evidenceIssues = auditAuthoringEvidence({
  quest,
  validationReport,
  expertReviews,
  expectedContentHash
})

if (evidenceIssues.length > 0) {
  console.error(`${slug}: content evidence audit failed`)
  for (const issue of evidenceIssues) {
    console.error(`- ${issue.code}: ${issue.message}`)
  }
  process.exit(1)
}

const generatedAt =
  process.env.CONTENT_REVISION_PACKET_NOW ?? new Date().toISOString()
const currentReviews = expertReviews.filter(
  (review) =>
    review.contentItemId === quest.id &&
    review.contentVersion === quest.version &&
    review.contentHash === validationReport.contentHash
)
const expertFollowUps = currentReviews
  .filter(
    (review) =>
      review.decision !== 'approved' || review.requiredFollowUps.length > 0
  )
  .map((review) => ({
    reviewId: review.id,
    reviewer: review.reviewer,
    decision: review.decision,
    notes: review.notes,
    requiredFollowUps: review.requiredFollowUps
  }))
const revisionTargetCount =
  validationReport.issues.length +
  expertFollowUps.reduce(
    (count, followUp) => count + getExpertFollowUpTargetCount(followUp),
    0
  )

const packet = validateContentRevisionPacket({
  id: `revision_packet_${quest.id}_${quest.version}_${compactTimestamp(generatedAt)}`,
  contentItemId: quest.id,
  contentVersion: quest.version,
  contentHash: validationReport.contentHash,
  generatedAt,
  source: deriveSource(validationReport.issues.length, expertFollowUps.length),
  questSummary: {
    slug: quest.slug,
    title: quest.title,
    status: quest.status,
    ageBand: quest.ageBand,
    learningObjectives: quest.learningObjectives
  },
  validation: {
    reportId: validationReport.id,
    status: validationReport.status,
    summary: validationReport.summary,
    issues: validationReport.issues
  },
  expertFollowUps,
  revisionTargetCount,
  refinementConstraints: [
    'Do not publish or mark content approved from a revision packet.',
    'Do not add child free-text collection unless a separate safety review approves it.',
    'Do not add diagnosis, therapy, medication, or crisis advice to child-facing copy.',
    'Keep guardian and teacher guidance aligned with revised child-facing activities.',
    'Regenerate validation evidence and obtain expert review after revision.'
  ]
})

if (outPath) {
  const resolvedOutPath = path.resolve(outPath)
  await mkdir(path.dirname(resolvedOutPath), { recursive: true })
  await writeFile(resolvedOutPath, `${JSON.stringify(packet, null, 2)}\n`)
  console.log(`${slug}: wrote revision packet to ${resolvedOutPath}`)
} else {
  console.log(JSON.stringify(packet, null, 2))
}

function deriveSource(issueCount, followUpCount) {
  if (issueCount > 0 && followUpCount > 0) return 'mixed'
  if (issueCount > 0) return 'validation'
  if (followUpCount > 0) return 'expert_review'
  return 'none'
}

function getExpertFollowUpTargetCount(followUp) {
  if (followUp.requiredFollowUps.length > 0) {
    return followUp.requiredFollowUps.length
  }

  return followUp.decision === 'approved' ? 0 : 1
}

function getOptionValue(name) {
  const index = args.indexOf(name)
  if (index === -1) return null
  const value = args[index + 1]
  if (!value || value.startsWith('--')) return null
  return value
}

function compactTimestamp(value) {
  return value.replace(/\W/g, '')
}
