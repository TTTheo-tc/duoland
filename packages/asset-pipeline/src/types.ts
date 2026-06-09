export type AssetKind = 'model' | 'animation' | 'texture' | 'audio' | 'subtitle'

export type AssetStatus = 'placeholder' | 'ready'

export interface AssetManifest {
  id: string
  version: string
  title: string
  description?: string
  performanceBudget: AssetPerformanceBudget
  assets: AssetDefinition[]
}

export interface AssetPerformanceBudget {
  maxInitialDownloadMb: number
  maxTrianglesPerScene: number
  maxTextureSize: number
  mobileTargetFps: number
}

export type AssetDefinition =
  | ModelAssetDefinition
  | AnimationAssetDefinition
  | TextureAssetDefinition
  | AudioAssetDefinition
  | SubtitleAssetDefinition

export interface AssetBase {
  id: string
  kind: AssetKind
  status: AssetStatus
  label: string
  uri?: string
  preload?: boolean
  sizeMb?: number
  license: AssetLicense
  tags?: string[]
}

export interface AssetLicense {
  owner: string
  source: string
  commercialUseAllowed: boolean
  attributionRequired?: boolean
  notes?: string
}

export interface ModelAssetDefinition extends AssetBase {
  kind: 'model'
  format: 'glb' | 'gltf'
  triangleCount?: number
  textureAssetIds?: string[]
  animationAssetIds?: string[]
  requiredAnimationClipIds?: string[]
}

export interface AnimationAssetDefinition extends AssetBase {
  kind: 'animation'
  format: 'glb' | 'gltf' | 'json'
  clipIds: string[]
}

export interface TextureAssetDefinition extends AssetBase {
  kind: 'texture'
  format: 'png' | 'jpg' | 'webp'
  maxDimension: number
}

export interface AudioAssetDefinition extends AssetBase {
  kind: 'audio'
  format: 'mp3' | 'ogg' | 'wav'
  durationSeconds?: number
  subtitleAssetId?: string
}

export interface SubtitleAssetDefinition extends AssetBase {
  kind: 'subtitle'
  format: 'vtt' | 'srt' | 'json'
  locale: string
}
