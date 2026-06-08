import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { validateQuestDefinition } from '@sel-quest/quest-core'
import { validateSelQuestContent } from '@sel-quest/content-validation'
import {
  assertQuestDirectorySlug,
  getRequestedQuestDirs,
  mergeDeterministicBaselineReport,
  readJsonIfExists
} from './script-utils.mjs'

const requestedSlugs = process.argv.slice(2)
const questDirs = await getRequestedQuestDirs(requestedSlugs)

const generatedReports = []

for (const { slug, questDir } of questDirs) {
  const questPath = path.join(questDir, 'quest.json')
  const reportPath = path.join(questDir, 'validation-report.json')
  const quest = validateQuestDefinition(JSON.parse(await readFile(questPath, 'utf8')))
  assertQuestDirectorySlug(quest, slug)
  const existingReport = await readJsonIfExists(reportPath)
  const createdAt =
    process.env.CONTENT_VALIDATION_NOW ??
    existingReport?.createdAt ??
    new Date().toISOString()

  const baselineReport = validateSelQuestContent(quest, {
    now: () => createdAt,
    reportId: existingReport?.id ?? `report_${quest.id}_${quest.version}_rules`
  })
  const report = mergeDeterministicBaselineReport(existingReport, baselineReport)

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  generatedReports.push({ slug, report })
}

for (const { slug, report } of generatedReports) {
  console.log(`${slug}: ${report.status} (${report.issues.length} issue(s))`)
}

const blockingReports = generatedReports.filter(({ report }) =>
  report.issues.some((issue) => issue.blocksPublishing)
)

if (blockingReports.length > 0) {
  process.exitCode = 1
}
