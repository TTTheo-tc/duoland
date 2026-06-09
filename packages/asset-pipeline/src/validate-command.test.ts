import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import type { AssetManifest } from './index.ts'
import type { WorldDefinition } from '@sel-quest/world-core'

const execFileAsync = promisify(execFile)
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)

describe('asset validation command', () => {
  it('validates quest asset manifests', async () => {
    const questsRoot = await writeAssetQuestFixture({})

    const result = await runValidateAssets(questsRoot, ['test-quest'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('test-quest: asset manifest valid')
  })

  it('fails for explicit missing quest slugs', async () => {
    const questsRoot = await mkdtemp(path.join(os.tmpdir(), 'sel-quest-assets-'))

    const result = await runValidateAssets(questsRoot, ['missing-quest'])

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('required file does not exist')
  })

  it('prints readable schema errors', async () => {
    const questsRoot = await writeAssetQuestFixture({
      assetManifest: {
        ...validAssetManifest,
        assets: [
          {
            ...validAssetManifest.assets[0],
            format: 'fbx'
          },
          validAssetManifest.assets[1]
        ]
      } as unknown as AssetManifest
    })

    const result = await runValidateAssets(questsRoot, ['test-quest'])

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('schema:')
    expect(result.stderr).toContain('assets.0.format')
  })
})

async function writeAssetQuestFixture(input: {
  world?: WorldDefinition
  assetManifest?: AssetManifest
}) {
  const questsRoot = await mkdtemp(path.join(os.tmpdir(), 'sel-quest-assets-'))
  const questDir = path.join(questsRoot, 'test-quest')

  await mkdir(questDir, { recursive: true })
  await writeFile(
    path.join(questDir, 'quest.json'),
    `${JSON.stringify({ id: 'test-quest', slug: 'test-quest' }, null, 2)}\n`
  )
  await writeFile(
    path.join(questDir, 'world.json'),
    `${JSON.stringify(input.world ?? validWorld, null, 2)}\n`
  )
  await writeFile(
    path.join(questDir, 'asset-manifest.json'),
    `${JSON.stringify(input.assetManifest ?? validAssetManifest, null, 2)}\n`
  )

  return questsRoot
}

async function runValidateAssets(questsRoot: string, args: string[]) {
  try {
    const result = await execFileAsync(process.execPath, [
      path.join(packageRoot, 'scripts', 'validate-assets.mjs'),
      ...args
    ], {
      cwd: packageRoot,
      env: {
        ...process.env,
        CONTENT_QUESTS_ROOT: questsRoot
      }
    })

    return {
      exitCode: 0,
      stdout: String(result.stdout),
      stderr: String(result.stderr)
    }
  } catch (error) {
    const failed = error as {
      code?: number
      stdout?: string | Buffer
      stderr?: string | Buffer
    }

    return {
      exitCode: typeof failed.code === 'number' ? failed.code : 1,
      stdout: String(failed.stdout ?? ''),
      stderr: String(failed.stderr ?? '')
    }
  }
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
