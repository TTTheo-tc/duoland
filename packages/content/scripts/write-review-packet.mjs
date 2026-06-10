import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { validateQuestDefinition } from '@sel-quest/quest-core'
import {
  auditAuthoringEvidence,
  createContentReviewPolicy
} from '@sel-quest/content-authoring'
import {
  validateContentExpertReview,
  validateContentReviewPacket,
  validateContentValidationReport
} from '@sel-quest/review-core'
import {
  assertQuestDirectorySlug,
  assertSupplementalContentEvidence,
  getContentBundleHash,
  getQuestDir,
  getQuestSlugArg,
  getValidationReportDriftIssues,
  normalizeJson,
  printValidationReportDrift,
  readJsonIfExists,
  structuredErrorMessages
} from './script-utils.mjs'

const args = process.argv.slice(2)
const slug = getQuestSlugArg(
  args,
  'Usage: npm run content:review-packet -- <quest-slug> [--out <path>]'
)
const outPath = getOptionValue('--out')

if (args.includes('--out') && !outPath) {
  console.error('--out requires a file path')
  process.exit(1)
}

const questDir = getQuestDir(slug)
const worldJson = await readJsonIfExists(path.join(questDir, 'world.json'))
const narrativeJson = await readJsonIfExists(path.join(questDir, 'narrative.json'))
const assetManifestJson = await readJsonIfExists(
  path.join(questDir, 'asset-manifest.json')
)
const reviewSurface = {
  usesWorldNarrative: Boolean(worldJson || narrativeJson),
  usesAssetRepresentation: Boolean(assetManifestJson)
}
const supplementalContent = { worldJson, narrativeJson, assetManifestJson }
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

try {
  assertSupplementalContentEvidence(
    quest,
    worldJson,
    narrativeJson,
    assetManifestJson
  )
} catch (error) {
  console.error(`${slug}: content evidence audit failed`)
  for (const message of structuredErrorMessages(error)) {
    console.error(`- ${message}`)
  }
  process.exit(1)
}

const expectedContentHash = getContentBundleHash(quest, supplementalContent)

const evidenceIssues = auditAuthoringEvidence({
  quest,
  validationReport,
  expertReviews,
  reviewSurface,
  expectedContentHash
})

if (evidenceIssues.length > 0) {
  console.error(`${slug}: content evidence audit failed`)
  for (const issue of evidenceIssues) {
    console.error(`- ${issue.code}: ${issue.message}`)
  }
  process.exit(1)
}

const driftIssues = getValidationReportDriftIssues(
  quest,
  validationReport,
  supplementalContent
)

if (driftIssues.length > 0) {
  printValidationReportDrift(slug, driftIssues)
  process.exit(1)
}

const generatedAt =
  process.env.CONTENT_REVIEW_PACKET_NOW ?? new Date().toISOString()
const packet = validateContentReviewPacket({
  id: `review_packet_${quest.id}_${quest.version}_${compactTimestamp(generatedAt)}`,
  contentItemId: quest.id,
  contentVersion: quest.version,
  contentHash: validationReport.contentHash,
  generatedAt,
  questSummary: {
    slug: quest.slug,
    title: quest.title,
    subtitle: quest.subtitle,
    description: quest.description,
    domain: quest.domain,
    ageBand: quest.ageBand,
    estimatedMinutes: quest.estimatedMinutes,
    learningObjectives: quest.learningObjectives
  },
  reviewableContent: {
    title: quest.title,
    subtitle: quest.subtitle,
    description: quest.description,
    domain: quest.domain,
    ageBand: quest.ageBand,
    estimatedMinutes: quest.estimatedMinutes,
    learningObjectives: quest.learningObjectives,
    safety: normalizeJson(quest.safety),
    guardianSummary: normalizeJson(quest.guardianSummary),
    teacherGuide: normalizeJson(quest.teacherGuide),
    stages: normalizeJson(quest.stages),
    activities: normalizeJson(quest.activities),
    assets: normalizeJson(quest.assets),
    world: normalizeOptionalJson(worldJson),
    narrative: normalizeOptionalJson(narrativeJson),
    assetManifest: normalizeOptionalJson(assetManifestJson)
  },
  validation: {
    reportId: validationReport.id,
    status: validationReport.status,
    summary: validationReport.summary,
    issueCount: validationReport.issues.length,
    blockingIssueCount: validationReport.issues.filter(
      (issue) => issue.blocksPublishing
    ).length,
    issues: validationReport.issues
  },
  existingReviews: expertReviews.map((review) => ({
    id: review.id,
    reviewer: review.reviewer,
    decision: review.decision,
    reviewCoverage: review.reviewCoverage,
    requiredFollowUpCount: review.requiredFollowUps.length,
    createdAt: review.createdAt
  })),
  reviewerChecklist: [
    'Confirm learning objectives are clear and age-appropriate.',
    'Check that child-facing feedback validates emotions before guiding behavior.',
    'Check that no diagnostic, therapy, or crisis-handling advice is given to the child.',
    'Confirm guardian and teacher guidance matches the child-facing activity intent.',
    `Record reviewedSections for ${getRequiredReviewSections().join(', ')} when covered.`,
    'Publication requires approved reviews from at least two distinct reviewers, including school_mental_health_teacher and safety_reviewer roles.',
    'Mark decision as approved only after requiredFollowUps is empty.'
  ],
  reviewTemplate: {
    id: `review_${quest.id}_${quest.version}_${compactTimestamp(generatedAt)}`,
    contentItemId: quest.id,
    contentVersion: quest.version,
    contentHash: validationReport.contentHash,
    reviewer: {
      id: 'reviewer_id_here',
      role: 'child_development_psychologist'
    },
    decision: 'changes_requested',
    reviewedIssueIds: validationReport.issues.map((issue) => issue.id),
    reviewCoverage: {
      reviewedSections: []
    },
    notes: ['Replace this note with expert review notes.'],
    requiredFollowUps: [
      'Replace this follow-up with required changes, or set to [] after explicit approval.'
    ],
    createdAt: generatedAt
  }
})

if (outPath) {
  const resolvedOutPath = path.resolve(outPath)
  await mkdir(path.dirname(resolvedOutPath), { recursive: true })
  await writeFile(resolvedOutPath, `${JSON.stringify(packet, null, 2)}\n`)
  console.log(`${slug}: wrote review packet to ${resolvedOutPath}`)
} else {
  console.log(JSON.stringify(packet, null, 2))
}

function getOptionValue(name) {
  const index = args.indexOf(name)
  if (index === -1) return null
  const value = args[index + 1]
  if (!value || value.startsWith('--')) return null
  return value
}

function getRequiredReviewSections() {
  return createContentReviewPolicy(reviewSurface).requiredCoverageSections
}

function normalizeOptionalJson(value) {
  return value ? normalizeJson(value) : undefined
}

function compactTimestamp(value) {
  return value.replace(/\W/g, '')
}
