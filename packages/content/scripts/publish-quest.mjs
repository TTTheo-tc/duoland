import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { validateQuestDefinition } from '@sel-quest/quest-core'
import {
  assertWorldBindingReference,
  validateWorldDefinition
} from '@sel-quest/world-core'
import {
  assertAssetManifestReference,
  assertWorldAssetReferences,
  validateAssetManifest
} from '@sel-quest/asset-pipeline'
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
  getQuestDir,
  getQuestSlugArg,
  getValidationReportDriftIssues,
  printValidationReportDrift,
  readJsonIfExists
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
const assetManifestJson = await readJsonIfExists(assetManifestPath)

if (quest.status === 'archived') {
  console.error(`${slug}: archived content cannot be published`)
  process.exit(1)
}

try {
  assertAssetEvidence(quest, worldJson, assetManifestJson)
} catch (error) {
  console.error(`${slug}: asset evidence audit failed`)
  printStructuredError(error)
  process.exit(1)
}

const evidenceIssues = auditAuthoringEvidence({
  quest,
  validationReport,
  expertReviews
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
  expertReviews
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

function assertAssetEvidence(quest, worldJson, assetManifestJson) {
  const world = worldJson ? validateWorldDefinition(worldJson) : null

  if (quest.worldBinding && !world) {
    throw new Error('quest declares worldBinding without world.json')
  }

  if (quest.worldBinding && world) {
    assertWorldBindingReference(quest.worldBinding, world)
  }

  if (world?.assetManifestId && !assetManifestJson) {
    throw new Error('world declares assetManifestId without asset-manifest.json')
  }

  if (!world?.assetManifestId && !assetManifestJson) return

  if (!world?.assetManifestId && assetManifestJson) {
    throw new Error('asset-manifest.json exists but world.json has no assetManifestId')
  }

  const assetManifest = validateAssetManifest(assetManifestJson)
  assertAssetManifestReference(assetManifest, world.assetManifestId)
  assertWorldAssetReferences(world, assetManifest)
}

function printStructuredError(error) {
  if (Array.isArray(error?.issues)) {
    for (const issue of error.issues) {
      const severity = issue.severity ?? 'schema'
      const path = Array.isArray(issue.path) ? issue.path.join('.') : issue.path
      console.error(`- ${severity}: ${issue.code} at ${path}`)
    }
  } else {
    console.error(`- ${error?.message ?? String(error)}`)
  }
}
