import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createApprovedReview,
  runContentScript,
  validQuest,
  writeQuestFixture
} from './test-fixtures'

describe('content status command', () => {
  it('reports content waiting for expert review', async () => {
    const { questsRoot, validationReport } = await writeQuestFixture({
      quest: validQuest
    })

    const result = await runStatus(questsRoot)
    const [status] = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(status.slug).toBe('test-quest')
    expect(status.contentHash).toBe(validationReport.contentHash)
    expect(status.authoringState).toBe('needs_expert_review')
    expect(status.publishabilityReasons).toEqual([
      'quest status is draft',
      'missing expert approval'
    ])
    expect(status.evidenceIssues).toEqual([])
  })

  it('reports approved content before publication', async () => {
    const { questsRoot } = await writeQuestFixture({
      quest: validQuest,
      expertReviews: [createApprovedReview(validQuest)]
    })

    const result = await runStatus(questsRoot)
    const [status] = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(status.authoringState).toBe('approved')
    expect(status.expertReviewCount).toBe(1)
    expect(status.publishabilityReasons).toEqual(['quest status is draft'])
  })

  it('surfaces stale validation evidence issues', async () => {
    const { questsRoot } = await writeQuestFixture({
      quest: {
        ...validQuest,
        description: 'Changed after validation.'
      },
      validationQuest: validQuest
    })

    const result = await runStatus(questsRoot)
    const [status] = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(status.authoringState).toBe('auto_validation_failed')
    expect(status.evidenceIssues.map((issue: { code: string }) => issue.code)).toEqual([
      'validation_report_hash_mismatch'
    ])
  })

  it('surfaces validation report drift issues', async () => {
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
            {
              ...validationReport.validators[0],
              summary: 'Tampered summary.'
            }
          ]
        },
        null,
        2
      )}\n`
    )

    const result = await runStatus(questsRoot)
    const [status] = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(status.evidenceIssues).toEqual([])
    expect(status.validationDriftIssues).toEqual([
      'validation report does not match deterministic validator output'
    ])
  })

  it('rejects path-like quest slugs', async () => {
    const { questsRoot } = await writeQuestFixture({ quest: validQuest })

    const result = await runContentScript({
      scriptName: 'show-authoring-status.mjs',
      args: ['../test-quest', '--json'],
      questsRoot
    })

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('invalid quest slug')
  })
})

async function runStatus(questsRoot: string) {
  return runContentScript({
    scriptName: 'show-authoring-status.mjs',
    args: ['--json'],
    questsRoot
  })
}
