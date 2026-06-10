import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { validateQuestDefinition } from '@sel-quest/quest-core'
import {
  validateArchivedContentExpertReview,
  validateContentExpertReview,
  validateContentValidationReport
} from '@sel-quest/review-core'
import {
  assertQuestDirectorySlug,
  assertSupplementalContentEvidence,
  getContentBundleHash,
  getQuestDir,
  getQuestSlugArg,
  getValidationReportDriftIssues,
  printValidationReportDrift,
  readJsonIfExists,
  readSupplementalContentJson,
  structuredErrorMessages
} from './script-utils.mjs'

const args = process.argv.slice(2)
const slug = getQuestSlugArg(
  args,
  'Usage: npm run content:archive-stale-reviews -- <quest-slug> [--dry-run]'
)
const dryRun = args.includes('--dry-run') || args.includes('--check')

const questDir = getQuestDir(slug)
const quest = validateQuestDefinition(
  JSON.parse(await readFile(path.join(questDir, 'quest.json'), 'utf8'))
)
assertQuestDirectorySlug(quest, slug)
const validationReport = validateContentValidationReport(
  JSON.parse(await readFile(path.join(questDir, 'validation-report.json'), 'utf8'))
)
const reviewsPath = path.join(questDir, 'expert-reviews.json')
const archivedReviewsPath = path.join(questDir, 'archived-expert-reviews.json')
const expertReviews = JSON.parse(await readFile(reviewsPath, 'utf8')).map((review) =>
  validateContentExpertReview(review)
)
const archivedReviews = (await readJsonIfExists(archivedReviewsPath) ?? []).map(
  (review) => validateArchivedContentExpertReview(review)
)
const supplementalContent = await readSupplementalContentJson(questDir)
try {
  assertSupplementalContentEvidence(
    quest,
    supplementalContent.worldJson,
    supplementalContent.narrativeJson,
    supplementalContent.assetManifestJson
  )
} catch (error) {
  console.error(`${slug}: content evidence audit failed`)
  for (const message of structuredErrorMessages(error)) {
    console.error(`- ${message}`)
  }
  process.exit(1)
}

const currentContentHash = getContentBundleHash(quest, supplementalContent)
const validationIssues = validateCurrentValidationEvidence({
  quest,
  validationReport,
  currentContentHash
})

if (validationIssues.length > 0) {
  console.error(`${slug}: stale reviews were not archived`)
  for (const issue of validationIssues) {
    console.error(`- ${issue}`)
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

const partition = partitionReviews({
  quest,
  currentContentHash,
  expertReviews
})

if (partition.invalidReasons.length > 0) {
  console.error(`${slug}: stale reviews were not archived`)
  for (const issue of partition.invalidReasons) {
    console.error(`- ${issue}`)
  }
  process.exit(1)
}

if (dryRun) {
  console.log(
    `${slug}: would archive ${partition.staleReviews.length} stale expert review(s)`
  )
} else {
  const archivedAt =
    process.env.CONTENT_ARCHIVE_STALE_REVIEWS_NOW ?? new Date().toISOString()
  const nextArchivedReviews = [
    ...archivedReviews,
    ...partition.staleReviews.map((review) =>
      validateArchivedContentExpertReview({
        archivedAt,
        reason: 'content_hash_changed',
        currentContentHash,
        review
      })
    )
  ]

  await writeFile(
    reviewsPath,
    `${JSON.stringify(partition.currentReviews, null, 2)}\n`
  )

  if (partition.staleReviews.length > 0) {
    await writeFile(
      archivedReviewsPath,
      `${JSON.stringify(nextArchivedReviews, null, 2)}\n`
    )
  }

  console.log(
    `${slug}: archived ${partition.staleReviews.length} stale expert review(s)`
  )
}

function validateCurrentValidationEvidence(input) {
  const issues = []

  if (input.validationReport.contentItemId !== input.quest.id) {
    issues.push('validation report content id does not match quest id')
  }

  if (input.validationReport.contentVersion !== input.quest.version) {
    issues.push('validation report version does not match quest version')
  }

  if (input.validationReport.contentHash !== input.currentContentHash) {
    issues.push('validation report content hash does not match expected content hash')
  }

  return issues
}

function partitionReviews(input) {
  const currentReviews = []
  const staleReviews = []
  const invalidReasons = []

  for (const review of input.expertReviews) {
    if (review.contentItemId !== input.quest.id) {
      invalidReasons.push(
        `expert review ${review.id} content id does not match quest id`
      )
      continue
    }

    if (review.contentVersion !== input.quest.version) {
      invalidReasons.push(
        `expert review ${review.id} version does not match quest version`
      )
      continue
    }

    if (review.contentHash === input.currentContentHash) {
      currentReviews.push(review)
    } else {
      staleReviews.push(review)
    }
  }

  return { currentReviews, staleReviews, invalidReasons }
}
