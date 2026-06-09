import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { validateContentReviewPacket } from '@sel-quest/review-core'
import { describe, expect, it } from 'vitest'
import {
  runContentScript,
  validAssetManifest,
  validNarrative,
  validQuest,
  validWorld,
  writeQuestFixture
} from './test-fixtures'

describe('content review packet command', () => {
  it('prints a safe expert review packet with a non-approving template', async () => {
    const questWithAsset = {
      ...validQuest,
      assets: [
        {
          id: 'classroom_scene',
          type: 'image' as const,
          src: '/assets/classroom-scene.png',
          alt: 'A classroom scene'
        }
      ]
    }
    const { questsRoot, validationReport } = await writeQuestFixture({
      quest: questWithAsset
    })

    const result = await runContentScript({
      scriptName: 'write-review-packet.mjs',
      args: ['test-quest'],
      questsRoot,
      env: { CONTENT_REVIEW_PACKET_NOW: '2026-06-09T00:00:00.000Z' }
    })
    const packet = validateContentReviewPacket(JSON.parse(result.stdout))

    expect(result.exitCode).toBe(0)
    expect(packet.contentHash).toBe(validationReport.contentHash)
    expect(packet.validation.status).toBe('passed')
    expect(packet.questSummary.learningObjectives[0]).toMatchObject({
      id: 'lo_emotion_recognition',
      childFacingText: 'I can name how a character may feel.'
    })
    expect(packet.reviewableContent.learningObjectives).toEqual(
      packet.questSummary.learningObjectives
    )
    expect(packet.reviewableContent.guardianSummary.title).toBe(
      'Children practice safe choices'
    )
    expect(
      packet.reviewableContent.activities.map((activity) => activity.id)
    ).toContain('scenario_001')
    expect(packet.reviewableContent.teacherGuide?.objective).toBe(
      'Practice emotion recognition and help-seeking.'
    )
    expect(packet.reviewableContent.assets).toEqual(questWithAsset.assets)
    expect(packet.reviewableContent.world).toBeUndefined()
    expect(packet.reviewableContent.narrative).toBeUndefined()
    expect(packet.reviewableContent.assetManifest).toBeUndefined()
    expect(packet.existingReviews).toEqual([])
    expect(packet.reviewTemplate.decision).toBe('changes_requested')
    expect(packet.reviewTemplate.reviewCoverage.reviewedSections).toEqual([])
    expect(packet.reviewTemplate.requiredFollowUps.length).toBeGreaterThan(0)
  })

  it('includes world, narrative, and asset manifest surfaces when present', async () => {
    const quest = {
      ...validQuest,
      worldBinding: {
        worldId: 'test-world',
        entrySceneId: 'test_scene'
      },
      episodeIds: ['episode_test']
    }
    const { questsRoot } = await writeQuestFixture({
      quest,
      world: validWorld,
      narrative: validNarrative,
      assetManifest: validAssetManifest
    })

    const result = await runContentScript({
      scriptName: 'write-review-packet.mjs',
      args: ['test-quest'],
      questsRoot,
      env: { CONTENT_REVIEW_PACKET_NOW: '2026-06-09T00:00:00.000Z' }
    })
    const packet = validateContentReviewPacket(JSON.parse(result.stdout))

    expect(result.exitCode).toBe(0)
    expect(packet.reviewableContent.world?.id).toBe('test-world')
    expect(packet.reviewableContent.narrative?.id).toBe('test-narrative')
    expect(packet.reviewableContent.assetManifest?.id).toBe(
      'assets_test_world_0_1_0'
    )
    expect(packet.reviewerChecklist.join('\n')).toContain('world_narrative')
    expect(packet.reviewerChecklist.join('\n')).toContain('asset_representation')
  })

  it('writes the review packet to an explicit output path', async () => {
    const { questsRoot } = await writeQuestFixture({ quest: validQuest })
    const outPath = path.join(questsRoot, 'packet.json')

    const result = await runContentScript({
      scriptName: 'write-review-packet.mjs',
      args: ['test-quest', '--out', outPath],
      questsRoot,
      env: { CONTENT_REVIEW_PACKET_NOW: '2026-06-09T00:00:00.000Z' }
    })
    const packet = validateContentReviewPacket(
      JSON.parse(await readFile(outPath, 'utf8'))
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('wrote review packet')
    expect(packet.reviewTemplate.contentItemId).toBe('test-quest')
  })

  it('fails when persisted validation evidence is stale', async () => {
    const { questsRoot } = await writeQuestFixture({
      quest: {
        ...validQuest,
        description: 'Changed after validation.'
      },
      validationQuest: validQuest
    })

    const result = await runContentScript({
      scriptName: 'write-review-packet.mjs',
      args: ['test-quest'],
      questsRoot
    })

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('validation_report_hash_mismatch')
  })

  it('fails when validation report content drifts without a hash change', async () => {
    const { questsRoot, validationReport } = await writeQuestFixture({
      quest: validQuest
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

    const result = await runContentScript({
      scriptName: 'write-review-packet.mjs',
      args: ['test-quest'],
      questsRoot
    })

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('validation report is out of date')
  })
})
