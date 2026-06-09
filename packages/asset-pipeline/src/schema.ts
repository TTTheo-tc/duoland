import { z } from 'zod'

export const AssetKindSchema = z.enum([
  'model',
  'animation',
  'texture',
  'audio',
  'subtitle'
])

export const AssetStatusSchema = z.enum(['placeholder', 'ready'])

export const AssetLicenseSchema = z.object({
  owner: z.string().min(1),
  source: z.string().min(1),
  commercialUseAllowed: z.boolean(),
  attributionRequired: z.boolean().optional(),
  notes: z.string().min(1).optional()
})

export const AssetPerformanceBudgetSchema = z.object({
  maxInitialDownloadMb: z.number().positive(),
  maxTrianglesPerScene: z.number().int().positive(),
  maxTextureSize: z.number().int().positive(),
  mobileTargetFps: z.number().int().positive()
})

const AssetBaseSchema = z.object({
  id: z.string().min(1),
  status: AssetStatusSchema,
  label: z.string().min(1),
  uri: z.string().min(1).optional(),
  preload: z.boolean().optional(),
  sizeMb: z.number().positive().optional(),
  license: AssetLicenseSchema,
  tags: z.array(z.string().min(1)).optional()
})

export const ModelAssetSchema = AssetBaseSchema.extend({
  kind: z.literal('model'),
  format: z.enum(['glb', 'gltf']),
  triangleCount: z.number().int().positive().optional(),
  textureAssetIds: z.array(z.string().min(1)).optional(),
  animationAssetIds: z.array(z.string().min(1)).optional(),
  requiredAnimationClipIds: z.array(z.string().min(1)).optional()
})

export const AnimationAssetSchema = AssetBaseSchema.extend({
  kind: z.literal('animation'),
  format: z.enum(['glb', 'gltf', 'json']),
  clipIds: z.array(z.string().min(1)).min(1)
})

export const TextureAssetSchema = AssetBaseSchema.extend({
  kind: z.literal('texture'),
  format: z.enum(['png', 'jpg', 'webp']),
  maxDimension: z.number().int().positive()
})

export const AudioAssetSchema = AssetBaseSchema.extend({
  kind: z.literal('audio'),
  format: z.enum(['mp3', 'ogg', 'wav']),
  durationSeconds: z.number().positive().optional(),
  subtitleAssetId: z.string().min(1).optional()
})

export const SubtitleAssetSchema = AssetBaseSchema.extend({
  kind: z.literal('subtitle'),
  format: z.enum(['vtt', 'srt', 'json']),
  locale: z.string().min(2)
})

export const AssetDefinitionSchema = z.discriminatedUnion('kind', [
  ModelAssetSchema,
  AnimationAssetSchema,
  TextureAssetSchema,
  AudioAssetSchema,
  SubtitleAssetSchema
])

export const AssetManifestSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  performanceBudget: AssetPerformanceBudgetSchema,
  assets: z.array(AssetDefinitionSchema)
})
