import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createApprovedReview,
  runContentScript,
  validQuest,
  writeQuestFixture
} from './test-fixtures'
import type { AssetManifest } from '@sel-quest/asset-pipeline'
import type { WorldDefinition } from '@sel-quest/world-core'

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
      expertReviews: [createApprovedReview(worldBoundQuest)]
    })

    const result = await runPublish(questsRoot, ['test-quest'])

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('asset evidence audit failed')
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
      expertReviews: [createApprovedReview(worldBoundQuest)],
      world: validWorld,
      assetManifest: validAssetManifest
    })

    const result = await runPublish(questsRoot, ['test-quest'])

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('asset evidence audit failed')
    expect(result.stderr).toContain('unknown_world_id')
  })

  it('blocks publish when world asset evidence is missing', async () => {
    const { questsRoot } = await writeQuestFixture({
      quest: validQuest,
      expertReviews: [createApprovedReview(validQuest)],
      world: validWorld
    })

    const result = await runPublish(questsRoot, ['test-quest'])

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('asset evidence audit failed')
    expect(result.stderr).toContain('assetManifestId without asset-manifest.json')
  })

  it('blocks publish when world asset references drift', async () => {
    const { questsRoot } = await writeQuestFixture({
      quest: validQuest,
      expertReviews: [createApprovedReview(validQuest)],
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
    expect(result.stderr).toContain('asset evidence audit failed')
    expect(result.stderr).toContain('unknown_world_asset_id')
  })
})

async function runPublish(questsRoot: string, args: string[]) {
  return runContentScript({
    scriptName: 'publish-quest.mjs',
    args,
    questsRoot
  })
}

const validWorld: WorldDefinition = {
  id: 'test-world',
  version: '0.1.0',
  title: 'Test World',
  artDirection: {
    style: 'storybook_3d',
    mood: ['warm']
  },
  assetManifestId: 'assets_test_world_0_1_0',
  zones: [
    {
      id: 'test_zone',
      title: 'Test Zone',
      theme: 'emotion_harbor',
      sceneIds: ['test_scene']
    }
  ],
  scenes: [
    {
      id: 'test_scene',
      zoneId: 'test_zone',
      title: 'Test Scene',
      characterPlacements: [
        {
          characterId: 'test_character',
          position: [0, 0, 0],
          initialAnimation: 'idle'
        }
      ],
      interactableIds: []
    }
  ],
  characters: [
    {
      id: 'test_character',
      name: 'Test Character',
      role: 'child_peer',
      personalityTags: ['quiet'],
      asset: {
        modelAssetId: 'model_test_character',
        animationSetId: 'anim_test_character'
      },
      safetyProfile: {
        neverActsAsTherapist: true,
        canDiscussSensitiveTopics: false
      },
      dialogueStyle: {
        ageBand: '8-10',
        tone: 'warm',
        maxSentenceLength: 'short'
      }
    }
  ],
  interactables: []
}

const validAssetManifest: AssetManifest = {
  id: 'assets_test_world_0_1_0',
  version: '0.1.0',
  title: 'Test World Assets',
  performanceBudget: {
    maxInitialDownloadMb: 5,
    maxTrianglesPerScene: 12000,
    maxTextureSize: 1024,
    mobileTargetFps: 30
  },
  assets: [
    {
      id: 'model_test_character',
      kind: 'model',
      status: 'placeholder',
      label: 'Test Character Model',
      format: 'glb',
      triangleCount: 800,
      animationAssetIds: ['anim_test_character'],
      requiredAnimationClipIds: ['idle'],
      license: {
        owner: 'Duoland',
        source: 'internal placeholder',
        commercialUseAllowed: true
      }
    },
    {
      id: 'anim_test_character',
      kind: 'animation',
      status: 'placeholder',
      label: 'Test Character Animation',
      format: 'json',
      clipIds: ['idle'],
      license: {
        owner: 'Duoland',
        source: 'internal placeholder',
        commercialUseAllowed: true
      }
    }
  ]
}
