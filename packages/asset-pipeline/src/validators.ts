import { AssetManifestSchema } from './schema.ts'
import type {
  AnimationAssetDefinition,
  AssetDefinition,
  AssetManifest
} from './types.ts'
import type { WorldDefinition } from '@sel-quest/world-core'

export interface AssetValidationIssue {
  path: string
  code: string
  message: string
  severity: 'error' | 'warning'
}

export class AssetValidationError extends Error {
  issues: AssetValidationIssue[]

  constructor(issues: AssetValidationIssue[]) {
    super('Asset manifest validation failed')
    this.issues = issues
  }
}

export function validateAssetManifest(input: unknown): AssetManifest {
  const manifest = AssetManifestSchema.parse(input) as AssetManifest
  const issues = validateAssetManifestSemantics(manifest)

  if (issues.some((issue) => issue.severity === 'error')) {
    throw new AssetValidationError(issues)
  }

  return manifest
}

export function assertAssetManifestReference(
  manifest: AssetManifest,
  assetManifestId: string
): void {
  if (manifest.id !== assetManifestId) {
    throw new AssetValidationError([
      error(
        'assetManifestId',
        'asset_manifest_id_mismatch',
        'World assetManifestId does not match the asset manifest id.'
      )
    ])
  }
}

export function assertWorldAssetReferences(
  world: WorldDefinition,
  manifest: AssetManifest
): void {
  const issues = validateWorldAssetReferences(world, manifest)

  if (issues.some((issue) => issue.severity === 'error')) {
    throw new AssetValidationError(issues)
  }
}

export function validateWorldAssetReferences(
  world: WorldDefinition,
  manifest: AssetManifest
): AssetValidationIssue[] {
  const issues: AssetValidationIssue[] = []
  const assetsById = new Map(manifest.assets.map((asset) => [asset.id, asset]))
  const animationClipIdsByAssetId = new Map(
    manifest.assets
      .filter((asset): asset is AnimationAssetDefinition => asset.kind === 'animation')
      .map((asset) => [asset.id, new Set(asset.clipIds)])
  )

  for (const scene of world.scenes) {
    if (scene.environmentAssetId) {
      assertAssetKind({
        assetsById,
        assetId: scene.environmentAssetId,
        expectedKind: 'model',
        path: `scenes.${scene.id}.environmentAssetId`,
        issues
      })
    }

    for (const placement of scene.characterPlacements) {
      const character = world.characters.find(
        (candidate) => candidate.id === placement.characterId
      )

      if (!character) continue

      if (placement.initialAnimation) {
        const animationSetId = character.asset.animationSetId
        if (!animationSetId) {
          issues.push(
            error(
              `scenes.${scene.id}.characterPlacements.${placement.characterId}.initialAnimation`,
              'character_initial_animation_missing_animation_set',
              'Character placement declares an initial animation but the character has no animation set.'
            )
          )
        } else if (
          !animationClipIdsByAssetId
            .get(animationSetId)
            ?.has(placement.initialAnimation)
        ) {
          issues.push(
            error(
              `scenes.${scene.id}.characterPlacements.${placement.characterId}.initialAnimation`,
              'unknown_character_initial_animation_clip',
              'Character placement initial animation is not declared by the character animation set.'
            )
          )
        }
      }
    }
  }

  for (const character of world.characters) {
    if (character.asset.modelAssetId) {
      assertAssetKind({
        assetsById,
        assetId: character.asset.modelAssetId,
        expectedKind: 'model',
        path: `characters.${character.id}.asset.modelAssetId`,
        issues
      })
    }

    if (character.asset.portraitAssetId) {
      assertAssetKind({
        assetsById,
        assetId: character.asset.portraitAssetId,
        expectedKind: 'texture',
        path: `characters.${character.id}.asset.portraitAssetId`,
        issues
      })
    }

    if (character.asset.animationSetId) {
      assertAssetKind({
        assetsById,
        assetId: character.asset.animationSetId,
        expectedKind: 'animation',
        path: `characters.${character.id}.asset.animationSetId`,
        issues
      })
    }
  }

  return issues
}

export function validateAssetManifestSemantics(
  manifest: AssetManifest
): AssetValidationIssue[] {
  const issues: AssetValidationIssue[] = []
  const assetIds = collectIds(
    manifest.assets,
    'assets',
    'duplicate_asset_id',
    'Duplicate asset id.'
  )
  const animationAssets = manifest.assets.filter(
    (asset): asset is AnimationAssetDefinition => asset.kind === 'animation'
  )
  const animationClipIds = new Set(
    animationAssets.flatMap((asset) => asset.clipIds)
  )
  const preloadTotalMb = manifest.assets.reduce(
    (total, asset) => total + (asset.preload ? asset.sizeMb ?? 0 : 0),
    0
  )

  issues.push(...assetIds.issues)

  if (preloadTotalMb > manifest.performanceBudget.maxInitialDownloadMb) {
    issues.push(
      error(
        'performanceBudget.maxInitialDownloadMb',
        'initial_download_budget_exceeded',
        'Preloaded assets exceed the initial download budget.'
      )
    )
  }

  for (const asset of manifest.assets) {
    if (asset.status === 'ready' && !asset.uri) {
      issues.push(
        error(
          `assets.${asset.id}.uri`,
          'ready_asset_missing_uri',
          'Ready assets must declare a URI.'
        )
      )
    }

    if (asset.status === 'ready' && asset.preload && !asset.sizeMb) {
      issues.push(
        error(
          `assets.${asset.id}.sizeMb`,
          'ready_preload_asset_missing_size',
          'Ready preloaded assets must declare sizeMb for budget checks.'
        )
      )
    }

    if (asset.status === 'placeholder' && asset.uri) {
      issues.push(
        warning(
          `assets.${asset.id}.uri`,
          'placeholder_asset_has_uri',
          'Placeholder assets should not point to production media.'
        )
      )
    }

    if (!asset.license.commercialUseAllowed) {
      issues.push(
        error(
          `assets.${asset.id}.license.commercialUseAllowed`,
          'asset_license_not_commercial',
          'Assets must be cleared for commercial use before entering a manifest.'
        )
      )
    }

    if (asset.kind === 'model') {
      if (asset.status === 'ready' && !asset.triangleCount) {
        issues.push(
          error(
            `assets.${asset.id}.triangleCount`,
            'ready_model_missing_triangle_count',
            'Ready model assets must declare triangleCount for budget checks.'
          )
        )
      }

      if (
        asset.triangleCount &&
        asset.triangleCount > manifest.performanceBudget.maxTrianglesPerScene
      ) {
        issues.push(
          error(
            `assets.${asset.id}.triangleCount`,
            'model_triangle_budget_exceeded',
            'Model triangle count exceeds the scene budget.'
          )
        )
      }

      for (const textureAssetId of asset.textureAssetIds ?? []) {
        const textureAsset = findAsset(manifest.assets, textureAssetId)
        if (!textureAsset) {
          issues.push(
            error(
              `assets.${asset.id}.textureAssetIds`,
              'unknown_model_texture_asset_id',
              'Model references an unknown texture asset.'
            )
          )
        } else if (textureAsset.kind !== 'texture') {
          issues.push(
            error(
              `assets.${asset.id}.textureAssetIds`,
              'model_texture_asset_kind_mismatch',
              'Model texture references must point to texture assets.'
            )
          )
        }
      }

      for (const animationAssetId of asset.animationAssetIds ?? []) {
        const animationAsset = findAsset(manifest.assets, animationAssetId)
        if (!animationAsset) {
          issues.push(
            error(
              `assets.${asset.id}.animationAssetIds`,
              'unknown_model_animation_asset_id',
              'Model references an unknown animation asset.'
            )
          )
        } else if (animationAsset.kind !== 'animation') {
          issues.push(
            error(
              `assets.${asset.id}.animationAssetIds`,
              'model_animation_asset_kind_mismatch',
              'Model animation references must point to animation assets.'
            )
          )
        }
      }

      for (const clipId of asset.requiredAnimationClipIds ?? []) {
        if (!animationClipIds.has(clipId)) {
          issues.push(
            error(
              `assets.${asset.id}.requiredAnimationClipIds`,
              'unknown_required_animation_clip_id',
              'Model requires an animation clip that is not declared by any animation asset.'
            )
          )
        }
      }
    }

    if (
      asset.kind === 'texture' &&
      asset.maxDimension > manifest.performanceBudget.maxTextureSize
    ) {
      issues.push(
        error(
          `assets.${asset.id}.maxDimension`,
          'texture_dimension_budget_exceeded',
          'Texture dimensions exceed the mobile texture budget.'
        )
      )
    }

    if (asset.kind === 'audio' && asset.subtitleAssetId) {
      const subtitleAsset = findAsset(manifest.assets, asset.subtitleAssetId)
      if (!subtitleAsset) {
        issues.push(
          error(
            `assets.${asset.id}.subtitleAssetId`,
            'unknown_audio_subtitle_asset_id',
            'Audio asset references an unknown subtitle asset.'
          )
        )
      } else if (subtitleAsset.kind !== 'subtitle') {
        issues.push(
          error(
            `assets.${asset.id}.subtitleAssetId`,
            'audio_subtitle_asset_kind_mismatch',
            'Audio subtitle references must point to subtitle assets.'
          )
        )
      }
    }
  }

  return issues
}

function collectIds<TItem extends { id: string }>(
  items: TItem[],
  path: string,
  duplicateCode: string,
  duplicateMessage: string
) {
  const ids = new Set<string>()
  const issues: AssetValidationIssue[] = []

  for (const item of items) {
    if (ids.has(item.id)) {
      issues.push(error(`${path}.${item.id}`, duplicateCode, duplicateMessage))
    }
    ids.add(item.id)
  }

  return { ids, issues }
}

function findAsset(assets: AssetDefinition[], assetId: string) {
  return assets.find((asset) => asset.id === assetId)
}

function assertAssetKind(input: {
  assetsById: Map<string, AssetDefinition>
  assetId: string
  expectedKind: AssetDefinition['kind']
  path: string
  issues: AssetValidationIssue[]
}) {
  const asset = input.assetsById.get(input.assetId)

  if (!asset) {
    input.issues.push(
      error(input.path, 'unknown_world_asset_id', 'World references an unknown asset.')
    )
  } else if (asset.kind !== input.expectedKind) {
    input.issues.push(
      error(
        input.path,
        'world_asset_kind_mismatch',
        `World asset reference must point to a ${input.expectedKind} asset.`
      )
    )
  }
}

function error(
  path: string,
  code: string,
  message: string
): AssetValidationIssue {
  return { path, code, message, severity: 'error' }
}

function warning(
  path: string,
  code: string,
  message: string
): AssetValidationIssue {
  return { path, code, message, severity: 'warning' }
}
