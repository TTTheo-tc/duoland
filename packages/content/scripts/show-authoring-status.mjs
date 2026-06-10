import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { validateQuestDefinition } from '@sel-quest/quest-core'
import {
  auditAuthoringEvidence,
  createAuthoringSnapshot
} from '@sel-quest/content-authoring'
import {
  validateContentExpertReview,
  validateContentValidationReport
} from '@sel-quest/review-core'
import {
  assertQuestDirectorySlug,
  getContentBundleHash,
  getRequestedQuestDirs,
  getValidationReportDriftIssues,
  readJsonIfExists
} from './script-utils.mjs'

const args = process.argv.slice(2)
const jsonOutput = args.includes('--json')
const questDirs = await getRequestedQuestDirs(args)

const statuses = []

for (const { slug, questDir } of questDirs) {
  statuses.push(await readAuthoringStatus(slug, questDir))
}

if (jsonOutput) {
  console.log(JSON.stringify(statuses, null, 2))
} else {
  for (const status of statuses) {
    console.log(`${status.slug}: ${status.authoringState}`)
    console.log(`  quest: ${status.questStatus}`)
    console.log(`  validation: ${status.validationStatus ?? 'missing'}`)
    console.log(`  expertReviews: ${status.expertReviewCount}`)

    for (const reason of status.publishabilityReasons) {
      console.log(`  - ${reason}`)
    }

    for (const issue of status.validationDriftIssues) {
      console.log(`  ! validation_report_drift: ${issue}`)
    }

    for (const issue of status.evidenceIssues) {
      console.log(`  ! ${issue.code}: ${issue.message}`)
    }
  }
}

async function readAuthoringStatus(slug, questDir) {
  const quest = validateQuestDefinition(
    JSON.parse(await readFile(path.join(questDir, 'quest.json'), 'utf8'))
  )
  assertQuestDirectorySlug(quest, slug)
  const validationReport = await readValidationReport(
    path.join(questDir, 'validation-report.json')
  )
  const expertReviews = await readExpertReviews(
    path.join(questDir, 'expert-reviews.json')
  )
  const worldJson = await readJsonIfExists(path.join(questDir, 'world.json'))
  const narrativeJson = await readJsonIfExists(
    path.join(questDir, 'narrative.json')
  )
  const assetManifestJson = await readJsonIfExists(
    path.join(questDir, 'asset-manifest.json')
  )
  const reviewSurface = {
    usesWorldNarrative: Boolean(worldJson || narrativeJson),
    usesAssetRepresentation: Boolean(assetManifestJson)
  }
  const supplementalContent = { worldJson, narrativeJson, assetManifestJson }
  const expectedContentHash = getContentBundleHash(quest, supplementalContent)
  const snapshot = createAuthoringSnapshot({
    quest,
    validationReport,
    expertReviews,
    reviewSurface,
    expectedContentHash
  })
  const evidenceIssues = auditAuthoringEvidence({
    quest,
    validationReport,
    expertReviews,
    reviewSurface,
    expectedContentHash
  })
  const validationDriftIssues = validationReport
    ? getValidationReportDriftIssues(quest, validationReport, supplementalContent)
    : []

  return {
    slug: quest.slug,
    contentItemId: snapshot.contentItemId,
    contentVersion: snapshot.contentVersion,
    contentHash: snapshot.contentHash,
    questStatus: quest.status,
    authoringState:
      validationDriftIssues.length > 0 ? 'auto_validation_failed' : snapshot.state,
    validationStatus: validationReport?.status ?? null,
    safetyDecision: validationReport?.summary.safetyDecision ?? null,
    expertReviewCount: expertReviews.length,
    publishabilityReasons: snapshot.publishabilityReasons,
    validationDriftIssues,
    evidenceIssues: evidenceIssues.map((issue) => ({
        severity: issue.severity,
        code: issue.code,
        message: issue.message,
        evidenceId: issue.evidenceId
      }))
  }
}

async function readValidationReport(filePath) {
  const value = await readJsonIfExists(filePath)
  return value ? validateContentValidationReport(value) : null
}

async function readExpertReviews(filePath) {
  const value = await readJsonIfExists(filePath)
  if (!value) return []
  return value.map((review) => validateContentExpertReview(review))
}
