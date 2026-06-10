import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { validateQuestDefinition } from '@sel-quest/quest-core'
import { validateContentValidationReport } from '@sel-quest/review-core'
import {
  assertQuestDirectorySlug,
  assertSupplementalContentEvidence,
  getBlockingIssueCount,
  getRequestedQuestDirs,
  getValidationReportDriftIssues,
  printValidationReportDrift,
  readSupplementalContentJson,
  structuredErrorMessages
} from './script-utils.mjs'

const requestedSlugs = process.argv.slice(2)
const questDirs = await getRequestedQuestDirs(requestedSlugs)

let hasFailure = false

for (const { slug, questDir } of questDirs) {
  const questPath = path.join(questDir, 'quest.json')
  const reportPath = path.join(questDir, 'validation-report.json')
  const quest = validateQuestDefinition(JSON.parse(await readFile(questPath, 'utf8')))
  assertQuestDirectorySlug(quest, slug)
  const report = validateContentValidationReport(
    JSON.parse(await readFile(reportPath, 'utf8'))
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
    hasFailure = true
    console.error(`${slug}: content evidence audit failed`)
    for (const message of structuredErrorMessages(error)) {
      console.error(`- ${message}`)
    }
    continue
  }

  const driftIssues = getValidationReportDriftIssues(
    quest,
    report,
    supplementalContent
  )

  if (driftIssues.length === 0) {
    console.log(`${slug}: validation report up to date`)
  } else {
    hasFailure = true
    printValidationReportDrift(slug, driftIssues)
  }

  const blockingIssueCount = getBlockingIssueCount(report)

  if (blockingIssueCount > 0) {
    hasFailure = true
    console.error(
      `${slug}: validation report contains ${blockingIssueCount} blocking issue(s)`
    )
  }
}

if (hasFailure) {
  process.exitCode = 1
}
