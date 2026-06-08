import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { validateContentRevisionPacket } from '@sel-quest/review-core'
import { describe, expect, it } from 'vitest'
import {
  createApprovedReview,
  runContentScript,
  validQuest,
  writeQuestFixture
} from './test-fixtures'

describe('content revision packet command', () => {
  it('reports no revision targets for clean content without expert feedback', async () => {
    const { questsRoot, validationReport } = await writeQuestFixture({
      quest: validQuest
    })

    const result = await runRevisionPacket(questsRoot)
    const packet = validateContentRevisionPacket(JSON.parse(result.stdout))

    expect(result.exitCode).toBe(0)
    expect(packet.contentHash).toBe(validationReport.contentHash)
    expect(packet.source).toBe('none')
    expect(packet.revisionTargetCount).toBe(0)
    expect(packet.validation.issues).toEqual([])
    expect(packet.expertFollowUps).toEqual([])
  })

  it('includes blocking validation issues as revision targets', async () => {
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

    const result = await runRevisionPacket(questsRoot)
    const packet = validateContentRevisionPacket(JSON.parse(result.stdout))

    expect(result.exitCode).toBe(0)
    expect(packet.source).toBe('validation')
    expect(packet.validation.status).toBe('blocked')
    expect(packet.validation.issues.map((issue) => issue.type)).toContain(
      'no_safe_response_option'
    )
    expect(packet.revisionTargetCount).toBe(1)
  })

  it('includes expert requested changes as revision targets', async () => {
    const changesRequested = {
      ...createApprovedReview(validQuest),
      id: 'review_changes_requested_001',
      decision: 'changes_requested',
      notes: ['Feedback should first validate the child character feeling.'],
      requiredFollowUps: ['Revise scenario feedback option B before approval.']
    } as const
    const { questsRoot } = await writeQuestFixture({
      quest: validQuest,
      expertReviews: [changesRequested]
    })

    const result = await runRevisionPacket(questsRoot)
    const packet = validateContentRevisionPacket(JSON.parse(result.stdout))

    expect(result.exitCode).toBe(0)
    expect(packet.source).toBe('expert_review')
    expect(packet.expertFollowUps).toHaveLength(1)
    expect(packet.expertFollowUps[0].reviewId).toBe(changesRequested.id)
    expect(packet.revisionTargetCount).toBe(1)
  })

  it('writes a revision packet to an explicit output path', async () => {
    const { questsRoot } = await writeQuestFixture({ quest: validQuest })
    const outPath = path.join(questsRoot, 'revision-packet.json')

    const result = await runRevisionPacket(questsRoot, ['--out', outPath])
    const packet = validateContentRevisionPacket(
      JSON.parse(await readFile(outPath, 'utf8'))
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('wrote revision packet')
    expect(packet.contentItemId).toBe('test-quest')
  })

  it('fails when persisted validation evidence is stale', async () => {
    const { questsRoot } = await writeQuestFixture({
      quest: {
        ...validQuest,
        description: 'Changed after validation.'
      },
      validationQuest: validQuest
    })

    const result = await runRevisionPacket(questsRoot)

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('validation_report_hash_mismatch')
  })
})

async function runRevisionPacket(questsRoot: string, args: string[] = []) {
  return runContentScript({
    scriptName: 'write-revision-packet.mjs',
    args: ['test-quest', ...args],
    questsRoot,
    env: { CONTENT_REVISION_PACKET_NOW: '2026-06-09T00:00:00.000Z' }
  })
}
