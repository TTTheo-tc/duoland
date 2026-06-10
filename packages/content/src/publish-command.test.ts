import { readFile, writeFile } from 'node:fs/promises'
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
      expertReviews: createRequiredApprovedReviews(validQuest)
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
      expertReviews: createRequiredApprovedReviews(validQuest)
    })

    const result = await runPublish(questsRoot, ['test-quest'])
    const quest = JSON.parse(
      await readFile(path.join(questsRoot, 'test-quest', 'quest.json'), 'utf8')
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('test-quest: published')
    expect(quest.status).toBe('published')
  })

  it('publishes world-bound content only with world and asset review coverage', async () => {
    const worldBoundQuest = {
      ...validQuest,
      worldBinding: {
        worldId: 'test-world',
        entrySceneId: 'test_scene'
      }
    }
    const { questsRoot } = await writeQuestFixture({
      quest: worldBoundQuest,
      expertReviews: createRequiredApprovedReviews(worldBoundQuest, {
        extraReviewedSections: ['world_narrative', 'asset_representation'],
        contentHash: createContentBundleHash({
          quest: worldBoundQuest,
          world: validWorld,
          assetManifest: validAssetManifest
        })
      }),
      world: validWorld,
      assetManifest: validAssetManifest
    })

    const result = await runPublish(questsRoot, ['test-quest', '--dry-run'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('test-quest: publishable')
  })

  it('blocks world-bound content without world and asset review coverage', async () => {
    const worldBoundQuest = {
      ...validQuest,
      worldBinding: {
        worldId: 'test-world',
        entrySceneId: 'test_scene'
      }
    }
    const { questsRoot } = await writeQuestFixture({
      quest: worldBoundQuest,
      expertReviews: createRequiredApprovedReviews(worldBoundQuest, {
        contentHash: createContentBundleHash({
          quest: worldBoundQuest,
          world: validWorld,
          assetManifest: validAssetManifest
        })
      }),
      world: validWorld,
      assetManifest: validAssetManifest
    })

    const result = await runPublish(questsRoot, ['test-quest', '--dry-run'])

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain(
      'missing review coverage section world_narrative'
    )
    expect(result.stderr).toContain(
      'missing review coverage section asset_representation'
    )
  })

  it('blocks publish when validation report content drifts without a hash change', async () => {
    const { questsRoot, validationReport } = await writeQuestFixture({
      quest: validQuest,
      expertReviews: createRequiredApprovedReviews(validQuest)
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

  it('blocks publish when a world-bound quest is missing world evidence', async () => {
    const worldBoundQuest = {
      ...validQuest,
      worldBinding: {
        worldId: 'test-world',
        entrySceneId: 'test_scene'
      }
    }
    const { questsRoot } = await writeQuestFixture({
      quest: worldBoundQuest,
      expertReviews: createRequiredApprovedReviews(worldBoundQuest)
    })

    const result = await runPublish(questsRoot, ['test-quest'])

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('content evidence audit failed')
    expect(result.stderr).toContain('worldBinding without world.json')
  })

  it('blocks publish when quest world binding drifts', async () => {
    const worldBoundQuest = {
      ...validQuest,
      worldBinding: {
        worldId: 'other-world',
        entrySceneId: 'test_scene'
      }
    }
    const { questsRoot } = await writeQuestFixture({
      quest: worldBoundQuest,
      expertReviews: createRequiredApprovedReviews(worldBoundQuest),
      world: validWorld,
      assetManifest: validAssetManifest
    })

    const result = await runPublish(questsRoot, ['test-quest'])

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('content evidence audit failed')
    expect(result.stderr).toContain('unknown_world_id')
  })

  it('blocks publish when world asset evidence is missing', async () => {
    const { questsRoot } = await writeQuestFixture({
      quest: validQuest,
      expertReviews: createRequiredApprovedReviews(validQuest),
      world: validWorld
    })

    const result = await runPublish(questsRoot, ['test-quest'])

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('content evidence audit failed')
    expect(result.stderr).toContain('assetManifestId without asset-manifest.json')
  })

  it('blocks publish when world asset references drift', async () => {
    const { questsRoot } = await writeQuestFixture({
      quest: validQuest,
      expertReviews: createRequiredApprovedReviews(validQuest),
      world: {
        ...validWorld,
        characters: [
          {
            ...validWorld.characters[0],
            asset: {
              ...validWorld.characters[0].asset,
              modelAssetId: 'missing_model'
            }
          }
        ]
      },
      assetManifest: validAssetManifest
    })

    const result = await runPublish(questsRoot, ['test-quest'])

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('content evidence audit failed')
    expect(result.stderr).toContain('unknown_world_asset_id')
  })

  it('blocks publish when narrative references drift', async () => {
    const narrativeQuest = {
      ...validQuest,
      episodeIds: ['episode_test']
    }
    const { questsRoot } = await writeQuestFixture({
      quest: narrativeQuest,
      expertReviews: createRequiredApprovedReviews(narrativeQuest, {
        extraReviewedSections: ['world_narrative', 'asset_representation']
      }),
      world: validWorld,
      assetManifest: validAssetManifest,
      narrative: {
        ...validNarrative,
        episodes: [
          {
            ...validNarrative.episodes[0],
            beats: [
              {
                id: 'beat_missing_activity',
                kind: 'activity',
                activityId: 'missing_activity',
                learningObjectiveIds: ['lo_emotion_recognition']
              }
            ]
          }
        ]
      }
    })

    const result = await runPublish(questsRoot, ['test-quest', '--dry-run'])

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('content evidence audit failed')
    expect(result.stderr).toContain('unknown_beat_activity_id')
  })
})

async function runPublish(questsRoot: string, args: string[]) {
  return runContentScript({
    scriptName: 'publish-quest.mjs',
    args,
    questsRoot
  })
}
