export type Vec3 = [number, number, number]

export interface CameraPose {
  position: Vec3
  target: Vec3
  fov?: number
}

export type WorldArtStyle = 'storybook_3d' | 'low_poly' | 'cartoon' | 'clay'

export type WorldZoneTheme =
  | 'emotion_harbor'
  | 'calm_garden'
  | 'friendship_forest'
  | 'choice_bridge'
  | 'courage_mountain'
  | 'home_school_station'

export type WorldLightingPreset =
  | 'soft_day'
  | 'warm_home'
  | 'calm_blue'
  | 'story_night'

export interface WorldDefinition {
  id: string
  version: string
  title: string
  description?: string
  artDirection: WorldArtDirection
  zones: WorldZone[]
  scenes: SceneDefinition[]
  characters: CharacterDefinition[]
  interactables: InteractableDefinition[]
  assetManifestId?: string
}

export interface WorldArtDirection {
  style: WorldArtStyle
  mood: string[]
}

export interface WorldZone {
  id: string
  title: string
  theme: WorldZoneTheme
  sceneIds: string[]
  unlockWhen?: WorldUnlockRule[]
}

export type WorldUnlockRule =
  | {
      type: 'world_flag'
      flag: string
      equals: boolean | string | number
    }
  | {
      type: 'scene_visited'
      sceneId: string
    }

export interface SceneDefinition {
  id: string
  zoneId: string
  title: string
  environmentAssetId?: string
  cameraStart?: CameraPose
  characterPlacements: CharacterPlacement[]
  interactableIds: string[]
  lightingPreset?: WorldLightingPreset
}

export interface CharacterPlacement {
  characterId: string
  position: Vec3
  rotationY?: number
  initialAnimation?: string
}

export type CharacterRole =
  | 'guide'
  | 'child_peer'
  | 'teacher_like_figure'
  | 'guardian_like_figure'
  | 'creature'
  | 'player_avatar'

export interface CharacterDefinition {
  id: string
  name: string
  role: CharacterRole
  personalityTags: string[]
  asset: CharacterAssetReference
  safetyProfile: CharacterSafetyProfile
  dialogueStyle: CharacterDialogueStyle
}

export interface CharacterAssetReference {
  modelAssetId?: string
  portraitAssetId?: string
  animationSetId?: string
}

export interface CharacterSafetyProfile {
  neverActsAsTherapist: true
  canDiscussSensitiveTopics: boolean
  crisisRedirectPolicyId?: string
}

export interface CharacterDialogueStyle {
  ageBand: '6-8' | '8-10' | '10-12' | '12-15'
  tone: 'warm' | 'curious' | 'playful' | 'calm'
  maxSentenceLength: 'short' | 'medium'
}

export type InteractableType =
  | 'npc'
  | 'object'
  | 'portal'
  | 'emotion_clue'
  | 'calm_tool'
  | 'choice_node'
  | 'memory_fragment'

export interface InteractableDefinition {
  id: string
  sceneId: string
  type: InteractableType
  label: string
  characterId?: string
  position: Vec3
  radius: number
  onInteract: WorldAction[]
}

export type WorldAction =
  | {
      type: 'start_dialogue'
      dialogueId: string
    }
  | {
      type: 'start_activity'
      activityId: string
    }
  | {
      type: 'play_cutscene'
      cutsceneId: string
    }
  | {
      type: 'transition_scene'
      sceneId: string
    }
  | {
      type: 'set_world_flag'
      flag: string
      value: boolean | string | number
    }

export interface WorldBindingReference {
  worldId: string
  entrySceneId: string
}

export interface WorldRuntimeState {
  worldId: string
  worldVersion: string
  activeSceneId: string
  visitedSceneIds: string[]
  completedInteractableIds: string[]
  flags: Record<string, boolean | string | number>
}
