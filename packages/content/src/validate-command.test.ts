import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { validateContentValidationReport } from '@sel-quest/review-core'
import { describe, expect, it } from 'vitest'
import {
  runContentScript,
  validAssetManifest,
  validQuest,
  validWorld,
  writeQuestFixture
} from './test-fixtures'

describe('content validation command', () => {
  it('refreshes validation reports in a configurable quest root', async () => {
    const { questsRoot, validationReport } = await writeQuestFixture({
      quest: validQuest
    })
    const staleReport = {
      ...validationReport,
      id: 'report_custom_id',
      contentHash: 'sha256_stale001',
      createdAt: '2026-01-01T00:00:00.000Z'
    }
    const reportPath = path.join(
      questsRoot,
      'test-quest',
      'validation-report.json'
    )
    await writeFile(reportPath, `${JSON.stringify(staleReport, null, 2)}\n`)

    const result = await runValidate(questsRoot, ['test-quest'])
    const report = validateContentValidationReport(
      JSON.parse(await readFile(reportPath, 'utf8'))
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('test-quest: passed (0 issue(s))')
    expect(report.id).toBe(staleReport.id)
    expect(report.createdAt).toBe(staleReport.createdAt)
    expect(report.contentHash).toBe(validationReport.contentHash)
  })

  it('preserves non-baseline validator runs when refreshing reports', async () => {
    const { questsRoot, validationReport } = await writeQuestFixture({
      quest: validQuest
    })
    const extraValidator = {
      id: 'run_manual_review_001',
      validatorId: 'manual.curriculum_review',
      validatorType: 'manual',
      status: 'passed',
      startedAt: '2026-06-09T01:00:00.000Z',
      completedAt: '2026-06-09T01:05:00.000Z',
      summary: 'Manual curriculum metadata retained.'
    }
    const reportPath = path.join(
      questsRoot,
      'test-quest',
      'validation-report.json'
    )
    await writeFile(
      reportPath,
      `${JSON.stringify(
        {
          ...validationReport,
          validators: [...validationReport.validators, extraValidator]
        },
        null,
        2
      )}\n`
    )

    const result = await runValidate(questsRoot, ['test-quest'])
    const report = validateContentValidationReport(
      JSON.parse(await readFile(reportPath, 'utf8'))
    )

    expect(result.exitCode).toBe(0)
    expect(report.validators).toContainEqual(extraValidator)
  })

  it('refreshes bundle hashes when supplemental content changes', async () => {
    const { questsRoot, validationReport } = await writeQuestFixture({
      quest: validQuest,
      world: validWorld,
      assetManifest: validAssetManifest
    })
    const questDir = path.join(questsRoot, 'test-quest')
    const reportPath = path.join(questDir, 'validation-report.json')
    await writeFile(
      path.join(questDir, 'world.json'),
      `${JSON.stringify(
        {
          ...validWorld,
          title: 'Changed Test World'
        },
        null,
        2
      )}\n`
    )

    const result = await runValidate(questsRoot, ['test-quest'])
    const report = validateContentValidationReport(
      JSON.parse(await readFile(reportPath, 'utf8'))
    )

    expect(result.exitCode).toBe(0)
    expect(report.contentHash).not.toBe(validationReport.contentHash)
  })

  it('returns structured evidence errors for malformed supplemental content', async () => {
    const { questsRoot } = await writeQuestFixture({
      quest: validQuest,
      world: validWorld,
      assetManifest: validAssetManifest
    })
    await writeFile(
      path.join(questsRoot, 'test-quest', 'world.json'),
      `${JSON.stringify(false, null, 2)}\n`
    )

    const result = await runValidate(questsRoot, ['test-quest'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('test-quest: content evidence audit failed')
    expect(result.stderr).toContain('schema')
  })

  it('writes blocking reports and exits nonzero for blocking content', async () => {
    const blockedQuest = {
      ...validQuest,
      activities: validQuest.activities.map((activity) =>
        activity.id === 'scenario_001'
          ? {
              ...activity,
              config: {
                scenarioText: 'What can the character do?',
                choices: [
                  {
                    id: 'push',
                    label: 'Push the classmate',
                    outcomeText: 'The conflict gets worse.',
                    learningSignal: 0
                  }
                ]
              }
            }
          : activity
      )
    }
    const { questsRoot } = await writeQuestFixture({ quest: blockedQuest })
    const reportPath = path.join(
      questsRoot,
      'test-quest',
      'validation-report.json'
    )

    const result = await runValidate(questsRoot, ['test-quest'])
    const report = validateContentValidationReport(
      JSON.parse(await readFile(reportPath, 'utf8'))
    )

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toContain('test-quest: blocked (1 issue(s))')
    expect(report.status).toBe('blocked')
  })

  it('validates quest schema before writing validation evidence', async () => {
    const invalidQuest = {
      ...validQuest,
      stages: validQuest.stages.map((stage) =>
        stage.id === 'scenario' ? { ...stage, next: 'missing_stage' } : stage
      )
    }
    const { questsRoot } = await writeQuestFixture({ quest: invalidQuest })

    const result = await runValidate(questsRoot, ['test-quest'])

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('Quest semantic validation failed')
  })
})

async function runValidate(questsRoot: string, args: string[] = []) {
  return runContentScript({
    scriptName: 'write-validation-reports.mjs',
    args,
    questsRoot
  })
}
