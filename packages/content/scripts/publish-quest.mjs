import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { validateQuestDefinition } from '@sel-quest/quest-core'
import {
  auditAuthoringEvidence,
  getAuthoringPublishabilityReasons
} from '@sel-quest/content-authoring'
import {
  validateContentExpertReview,
  validateContentValidationReport
} from '@sel-quest/review-core'
import {
  assertQuestDirectorySlug,
  assertSupplementalContentEvidence,
  getQuestDir,
  getQuestSlugArg,
  getValidationReportDriftIssues,
  printValidationReportDrift,
  readJsonIfExists,
  structuredErrorMessages
} from './script-utils.mjs'

const args = process.argv.slice(2)
const slug = getQuestSlugArg(
  args,
  'Usage: npm run content:publish -- <quest-slug> [--dry-run]'
)
const dryRun = args.includes('--dry-run') || args.includes('--check')

const questDir = getQuestDir(slug)
const questPath = path.join(questDir, 'quest.json')
const worldPath = path.join(questDir, 'world.json')
const narrativePath = path.join(questDir, 'narrative.json')
const assetManifestPath = path.join(questDir, 'asset-manifest.json')
const reportPath = path.join(questDir, 'validation-report.json')
const reviewsPath = path.join(questDir, 'expert-reviews.json')

const quest = validateQuestDefinition(JSON.parse(await readFile(questPath, 'utf8')))
assertQuestDirectorySlug(quest, slug)
const validationReport = validateContentValidationReport(
  JSON.parse(await readFile(reportPath, 'utf8'))
)
const expertReviews = JSON.parse(await readFile(reviewsPath, 'utf8')).map((review) =>
  validateContentExpertReview(review)
)
const worldJson = await readJsonIfExists(worldPath)
const narrativeJson = await readJsonIfExists(narrativePath)
const assetManifestJson = await readJsonIfExists(assetManifestPath)
const reviewSurface = {
  usesWorldNarrative: Boolean(worldJson || narrativeJson),
  usesAssetRepresentation: Boolean(assetManifestJson)
}

if (quest.status === 'archived') {
  console.error(`${slug}: archived content cannot be published`)
  process.exit(1)
}

try {
  assertSupplementalContentEvidence(
    quest,
    worldJson,
    narrativeJson,
    assetManifestJson
  )
} catch (error) {
  console.error(`${slug}: content evidence audit failed`)
  printStructuredError(error)
  process.exit(1)
}

const evidenceIssues = auditAuthoringEvidence({
  quest,
  validationReport,
  expertReviews,
  reviewSurface
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

const publishCandidate = {
  ...quest,
  status: 'published'
}
const publishabilityReasons = getAuthoringPublishabilityReasons({
  quest: publishCandidate,
  validationReport,
  expertReviews,
  reviewSurface
})

if (publishabilityReasons.length > 0) {
  console.error(`${slug}: content is not publishable`)
  for (const reason of publishabilityReasons) {
    console.error(`- ${reason}`)
  }
  process.exit(1)
}

if (dryRun) {
  console.log(`${slug}: publishable`)
} else {
  await mkdir(questDir, { recursive: true })
  await writeFile(questPath, `${JSON.stringify(publishCandidate, null, 2)}\n`)
  console.log(`${slug}: published`)
}

function printStructuredError(error) {
  for (const message of structuredErrorMessages(error)) {
    console.error(`- ${message}`)
  }
}
