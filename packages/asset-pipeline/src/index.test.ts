import { describe, expect, it } from 'vitest'
import {
  AssetValidationError,
  assertAssetManifestReference,
  assertWorldAssetReferences,
  validateAssetManifest,
  validateAssetManifestSemantics,
  validateWorldAssetReferences,
  type AssetManifest
} from './index.ts'
import type { WorldDefinition } from '@sel-quest/world-core'

const manifest: AssetManifest = {
  id: 'assets_emotion_town_0_1_0',
  version: '0.1.0',
  title: 'Emotion Town Assets',
  performanceBudget: {
    maxInitialDownloadMb: 5,
    maxTrianglesPerScene: 12000,
    maxTextureSize: 1024,
    mobileTargetFps: 30
  },
  assets: [
    {
      id: 'model_xiaoyu_placeholder',
      kind: 'model',
      status: 'placeholder',
      label: 'Xiaoyu placeholder',
      format: 'glb',
      triangleCount: 800,
      animationAssetIds: ['anim_child_peer_basic'],
      requiredAnimationClipIds: ['sad_idle'],
      license: {
        owner: 'Duoland',
        source: 'internal placeholder',
        commercialUseAllowed: true
      }
    },
    {
      id: 'anim_child_peer_basic',
      kind: 'animation',
      status: 'placeholder',
      label: 'Basic child peer animation set',
      format: 'json',
      clipIds: ['sad_idle'],
      license: {
        owner: 'Duoland',
        source: 'internal placeholder',
        commercialUseAllowed: true
      }
    }
  ]
}

const world: WorldDefinition = {
  id: 'emotion-town',
  version: '0.1.0',
  title: 'Emotion Town',
  artDirection: {
    style: 'storybook_3d',
    mood: ['warm']
  },
  assetManifestId: 'assets_emotion_town_0_1_0',
  zones: [
    {
      id: 'emotion_harbor',
      title: 'Emotion Harbor',
      theme: 'emotion_harbor',
      sceneIds: ['art_room']
    }
  ],
  scenes: [
    {
      id: 'art_room',
      zoneId: 'emotion_harbor',
      title: 'Art Room',
      characterPlacements: [
        {
          characterId: 'xiaoyu',
          position: [0, 0, 0],
          initialAnimation: 'sad_idle'
        }
      ],
      interactableIds: []
    }
  ],
  characters: [
    {
      id: 'xiaoyu',
      name: 'Xiaoyu',
      role: 'child_peer',
      personalityTags: ['quiet'],
      asset: {
        modelAssetId: 'model_xiaoyu_placeholder',
        animationSetId: 'anim_child_peer_basic'
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

describe('asset-pipeline', () => {
  it('validates an asset manifest', () => {
    expect(validateAssetManifest(manifest)).toEqual(manifest)
    expect(validateAssetManifestSemantics(manifest)).toEqual([])
    expect(() =>
      assertAssetManifestReference(manifest, 'assets_emotion_town_0_1_0')
    ).not.toThrow()
    expect(() => assertWorldAssetReferences(world, manifest)).not.toThrow()
    expect(validateWorldAssetReferences(world, manifest)).toEqual([])
  })

  it('rejects ready assets without URIs', () => {
    expect(() =>
      validateAssetManifest({
        ...manifest,
        assets: [{ ...manifest.assets[0], status: 'ready' }]
      })
    ).toThrow(AssetValidationError)
  })

  it('requires ready preloaded assets to declare sizes', () => {
    expect(
      validateAssetManifestSemantics({
        ...manifest,
        assets: [
          {
            ...manifest.assets[0],
            status: 'ready',
            uri: '/assets/xiaoyu.glb',
            preload: true,
            triangleCount: undefined
          },
          manifest.assets[1]
        ]
      }).map((issue) => issue.code)
    ).toEqual(
      expect.arrayContaining([
        'ready_preload_asset_missing_size',
        'ready_model_missing_triangle_count'
      ])
    )
  })

  it('rejects assets that exceed performance budgets', () => {
    const issues = validateAssetManifestSemantics({
      ...manifest,
      performanceBudget: {
        ...manifest.performanceBudget,
        maxInitialDownloadMb: 1,
        maxTrianglesPerScene: 500
      },
      assets: [
        {
          ...manifest.assets[0],
          triangleCount: 900,
          preload: true,
          sizeMb: 1.2
        },
        manifest.assets[1]
      ]
    })

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'initial_download_budget_exceeded',
        'model_triangle_budget_exceeded'
      ])
    )
  })

  it('rejects missing animation clip references', () => {
    expect(
      validateAssetManifestSemantics({
        ...manifest,
        assets: [
          {
            ...manifest.assets[0],
            requiredAnimationClipIds: ['missing_clip']
          },
          manifest.assets[1]
        ]
      }).map((issue) => issue.code)
    ).toContain('unknown_required_animation_clip_id')
  })

  it('rejects world references to missing assets', () => {
    expect(
      validateWorldAssetReferences(
        {
          ...world,
          characters: [
            {
              ...world.characters[0],
              asset: {
                ...world.characters[0].asset,
                modelAssetId: 'missing_model'
              }
            }
          ]
        },
        manifest
      ).map((issue) => issue.code)
    ).toContain('unknown_world_asset_id')
  })

  it('rejects initial animations missing from the character animation set', () => {
    expect(
      validateWorldAssetReferences(
        {
          ...world,
          scenes: [
            {
              ...world.scenes[0],
              characterPlacements: [
                {
                  ...world.scenes[0].characterPlacements[0],
                  initialAnimation: 'missing_clip'
                }
              ]
            }
          ]
        },
        manifest
      ).map((issue) => issue.code)
    ).toContain('unknown_character_initial_animation_clip')
  })

  it('rejects non-commercial licenses', () => {
    expect(
      validateAssetManifestSemantics({
        ...manifest,
        assets: [
          {
            ...manifest.assets[0],
            license: {
              ...manifest.assets[0].license,
              commercialUseAllowed: false
            }
          },
          manifest.assets[1]
        ]
      }).map((issue) => issue.code)
    ).toContain('asset_license_not_commercial')
  })

  it('rejects mismatched manifest ids', () => {
    expect(() => assertAssetManifestReference(manifest, 'other_manifest')).toThrow(
      AssetValidationError
    )
  })
})
