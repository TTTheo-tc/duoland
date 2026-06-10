import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createContentBundleHash } from '@sel-quest/content-authoring'
import { describe, expect, it } from 'vitest'
import {
  createRequiredApprovedReviews,
  runContentScript,
  validAssetManifest,
  validNarrative,
  validQuest,
  validWorld,
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
      'missing expert approval',
      'requires at least 2 approved expert reviews',
      'requires at least 2 distinct approving reviewers',
      'missing required reviewer role school_mental_health_teacher',
      'missing required reviewer role safety_reviewer',
      'missing review coverage section child_content',
      'missing review coverage section guardian_summary',
      'missing review coverage section teacher_guide',
      'missing review coverage section safety_policy',
      'missing review coverage section activity_feedback'
    ])
    expect(status.evidenceIssues).toEqual([])
  })

  it('reports approved content before publication', async () => {
    const { questsRoot } = await writeQuestFixture({
      quest: validQuest,
      expertReviews: createRequiredApprovedReviews(validQuest)
    })

    const result = await runStatus(questsRoot)
    const [status] = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(status.authoringState).toBe('approved')
    expect(status.expertReviewCount).toBe(2)
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

  it('surfaces supplemental content evidence issues', async () => {
    const narrativeQuest = {
      ...validQuest,
      episodeIds: ['episode_test']
    }
    const invalidNarrative = {
      ...validNarrative,
      episodes: [
        {
          ...validNarrative.episodes[0],
          beats: [
            {
              id: 'beat_missing_activity',
              kind: 'activity' as const,
              activityId: 'missing_activity',
              learningObjectiveIds: ['lo_emotion_recognition']
            }
          ]
        }
      ]
    }
    const { questsRoot } = await writeQuestFixture({
      quest: narrativeQuest,
      expertReviews: createRequiredApprovedReviews(narrativeQuest, {
        extraReviewedSections: ['world_narrative', 'asset_representation'],
        contentHash: createContentBundleHash({
          quest: narrativeQuest,
          world: validWorld,
          assetManifest: validAssetManifest,
          narrative: invalidNarrative
        })
      }),
      world: validWorld,
      assetManifest: validAssetManifest,
      narrative: invalidNarrative
    })

    const result = await runStatus(questsRoot)
    const [status] = JSON.parse(result.stdout)

    expect(result.exitCode).toBe(0)
    expect(status.authoringState).toBe('auto_validation_failed')
    expect(status.publishabilityReasons).toContain(
      'supplemental content evidence is invalid'
    )
    expect(status.evidenceIssues).toEqual([
      {
        severity: 'error',
        code: 'supplemental_content_evidence_invalid',
        message: 'error: unknown_beat_activity_id at episodes.episode_test.beats.beat_missing_activity'
      }
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
