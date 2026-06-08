import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createApprovedReview,
  runContentScript,
  validQuest,
  writeQuestFixture
} from './test-fixtures'

describe('content publish command', () => {
  it('blocks content without a matching expert approval', async () => {
    const { questsRoot } = await writeQuestFixture({ quest: validQuest })

    const result = await runPublish(questsRoot, ['test-quest', '--dry-run'])

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('missing expert approval')
  })

  it('does not change quest status during dry runs', async () => {
    const { questsRoot } = await writeQuestFixture({
      quest: validQuest,
      expertReviews: [createApprovedReview(validQuest)]
    })

    const result = await runPublish(questsRoot, ['test-quest', '--dry-run'])
    const quest = JSON.parse(
      await readFile(path.join(questsRoot, 'test-quest', 'quest.json'), 'utf8')
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('test-quest: publishable')
    expect(quest.status).toBe('draft')
  })

  it('publishes only when validation and expert review evidence match', async () => {
    const { questsRoot } = await writeQuestFixture({
      quest: validQuest,
      expertReviews: [createApprovedReview(validQuest)]
    })

    const result = await runPublish(questsRoot, ['test-quest'])
    const quest = JSON.parse(
      await readFile(path.join(questsRoot, 'test-quest', 'quest.json'), 'utf8')
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('test-quest: published')
    expect(quest.status).toBe('published')
  })

  it('blocks publish when validation report content drifts without a hash change', async () => {
    const { questsRoot, validationReport } = await writeQuestFixture({
      quest: validQuest,
      expertReviews: [createApprovedReview(validQuest)]
    })
    const reportPath = path.join(
      questsRoot,
      'test-quest',
      'validation-report.json'
    )
    const tamperedReport = {
      ...validationReport,
      validators: [
        {
          ...validationReport.validators[0],
          summary: 'Tampered summary.'
        }
      ]
    }
    await writeFile(reportPath, `${JSON.stringify(tamperedReport, null, 2)}\n`)

    const result = await runPublish(questsRoot, ['test-quest'])
    const quest = JSON.parse(
      await readFile(path.join(questsRoot, 'test-quest', 'quest.json'), 'utf8')
    )

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('validation report is out of date')
    expect(quest.status).toBe('draft')
  })
})

async function runPublish(questsRoot: string, args: string[]) {
  return runContentScript({
    scriptName: 'publish-quest.mjs',
    args,
    questsRoot
  })
}
