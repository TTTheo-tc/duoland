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

describe('content check validation command', () => {
  it('passes when persisted validation reports are up to date', async () => {
    const { questsRoot } = await writeQuestFixture({ quest: validQuest })

    const result = await runCheckValidation(questsRoot, ['test-quest'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('test-quest: validation report up to date')
  })

  it('hashes normalized supplemental content rather than raw unknown fields', async () => {
    const { questsRoot } = await writeQuestFixture({
      quest: validQuest,
      world: validWorld,
      assetManifest: validAssetManifest
    })
    await writeFile(
      path.join(questsRoot, 'test-quest', 'world.json'),
      `${JSON.stringify(
        {
          ...validWorld,
          unknownAuthoringNote: 'ignored by the world schema'
        },
        null,
        2
      )}\n`
    )

    const result = await runCheckValidation(questsRoot, ['test-quest'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('test-quest: validation report up to date')
  })

  it('allows extra non-baseline validator runs in an up-to-date report', async () => {
    const { questsRoot, validationReport } = await writeQuestFixture({
      quest: validQuest
    })
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
          validators: [
            ...validationReport.validators,
            {
              id: 'run_manual_review_001',
              validatorId: 'manual.curriculum_review',
              validatorType: 'manual',
              status: 'passed',
              startedAt: '2026-06-09T01:00:00.000Z',
              completedAt: '2026-06-09T01:05:00.000Z',
              summary: 'Manual curriculum metadata retained.'
            }
          ]
        },
        null,
        2
      )}\n`
    )

    const result = await runCheckValidation(questsRoot, ['test-quest'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('test-quest: validation report up to date')
  })

  it('fails without rewriting stale validation reports', async () => {
    const { questsRoot, validationReport } = await writeQuestFixture({
      quest: validQuest
    })
    const reportPath = path.join(
      questsRoot,
      'test-quest',
      'validation-report.json'
    )
    const staleReport = {
      ...validationReport,
      status: 'blocked'
    }
    await writeFile(reportPath, `${JSON.stringify(staleReport, null, 2)}\n`)

    const result = await runCheckValidation(questsRoot, ['test-quest'])
    const reportAfterCheck = validateContentValidationReport(
      JSON.parse(await readFile(reportPath, 'utf8'))
    )

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('test-quest: validation report is out of date')
    expect(reportAfterCheck.status).toBe('blocked')
  })

  it('fails when supplemental content changes without refreshing validation', async () => {
    const { questsRoot } = await writeQuestFixture({
      quest: validQuest,
      world: validWorld,
      assetManifest: validAssetManifest
    })
    await writeFile(
      path.join(questsRoot, 'test-quest', 'world.json'),
      `${JSON.stringify(
        {
          ...validWorld,
          title: 'Changed Test World'
        },
        null,
        2
      )}\n`
    )

    const result = await runCheckValidation(questsRoot, ['test-quest'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('test-quest: validation report is out of date')
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

    const result = await runCheckValidation(questsRoot, ['test-quest'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('test-quest: content evidence audit failed')
    expect(result.stderr).toContain('schema')
  })

  it('returns nonzero for up-to-date reports with blocking issues', async () => {
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

    const result = await runCheckValidation(questsRoot, ['test-quest'])

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toContain('test-quest: validation report up to date')
    expect(result.stderr).toContain(
      'test-quest: validation report contains 1 blocking issue(s)'
    )
  })

  it('validates quest schema before checking report drift', async () => {
    const invalidQuest = {
      ...validQuest,
      stages: validQuest.stages.map((stage) =>
        stage.id === 'scenario' ? { ...stage, next: 'missing_stage' } : stage
      )
    }
    const { questsRoot } = await writeQuestFixture({ quest: invalidQuest })

    const result = await runCheckValidation(questsRoot, ['test-quest'])

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('Quest semantic validation failed')
  })
})

async function runCheckValidation(questsRoot: string, args: string[] = []) {
  return runContentScript({
    scriptName: 'check-validation-reports.mjs',
    args,
    questsRoot
  })
}
