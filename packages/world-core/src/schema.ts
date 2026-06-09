import { z } from 'zod'

export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()])

export const CameraPoseSchema = z.object({
  position: Vec3Schema,
  target: Vec3Schema,
  fov: z.number().positive().optional()
})

export const WorldArtStyleSchema = z.enum([
  'storybook_3d',
  'low_poly',
  'cartoon',
  'clay'
])

export const WorldZoneThemeSchema = z.enum([
  'emotion_harbor',
  'calm_garden',
  'friendship_forest',
  'choice_bridge',
  'courage_mountain',
  'home_school_station'
])

export const WorldLightingPresetSchema = z.enum([
  'soft_day',
  'warm_home',
  'calm_blue',
  'story_night'
])

export const WorldUnlockRuleSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('world_flag'),
    flag: z.string().min(1),
    equals: z.union([z.boolean(), z.string(), z.number()])
  }),
  z.object({
    type: z.literal('scene_visited'),
    sceneId: z.string().min(1)
  })
])

export const WorldZoneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  theme: WorldZoneThemeSchema,
  sceneIds: z.array(z.string().min(1)).min(1),
  unlockWhen: z.array(WorldUnlockRuleSchema).optional()
})

export const CharacterPlacementSchema = z.object({
  characterId: z.string().min(1),
  position: Vec3Schema,
  rotationY: z.number().optional(),
  initialAnimation: z.string().min(1).optional()
})

export const CharacterRoleSchema = z.enum([
  'guide',
  'child_peer',
  'teacher_like_figure',
  'guardian_like_figure',
  'creature',
  'player_avatar'
])

export const CharacterAssetReferenceSchema = z.object({
  modelAssetId: z.string().min(1).optional(),
  portraitAssetId: z.string().min(1).optional(),
  animationSetId: z.string().min(1).optional()
})

export const CharacterSafetyProfileSchema = z.object({
  neverActsAsTherapist: z.literal(true),
  canDiscussSensitiveTopics: z.boolean(),
  crisisRedirectPolicyId: z.string().min(1).optional()
})

export const CharacterDialogueStyleSchema = z.object({
  ageBand: z.enum(['6-8', '8-10', '10-12', '12-15']),
  tone: z.enum(['warm', 'curious', 'playful', 'calm']),
  maxSentenceLength: z.enum(['short', 'medium'])
})

export const CharacterDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: CharacterRoleSchema,
  personalityTags: z.array(z.string().min(1)),
  asset: CharacterAssetReferenceSchema,
  safetyProfile: CharacterSafetyProfileSchema,
  dialogueStyle: CharacterDialogueStyleSchema
})

export const WorldActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('start_dialogue'),
    dialogueId: z.string().min(1)
  }),
  z.object({
    type: z.literal('start_activity'),
    activityId: z.string().min(1)
  }),
  z.object({
    type: z.literal('play_cutscene'),
    cutsceneId: z.string().min(1)
  }),
  z.object({
    type: z.literal('transition_scene'),
    sceneId: z.string().min(1)
  }),
  z.object({
    type: z.literal('set_world_flag'),
    flag: z.string().min(1),
    value: z.union([z.boolean(), z.string(), z.number()])
  })
])

export const InteractableTypeSchema = z.enum([
  'npc',
  'object',
  'portal',
  'emotion_clue',
  'calm_tool',
  'choice_node',
  'memory_fragment'
])

export const InteractableDefinitionSchema = z.object({
  id: z.string().min(1),
  sceneId: z.string().min(1),
  type: InteractableTypeSchema,
  label: z.string().min(1),
  characterId: z.string().min(1).optional(),
  position: Vec3Schema,
  radius: z.number().positive(),
  onInteract: z.array(WorldActionSchema).min(1)
})

export const SceneDefinitionSchema = z.object({
  id: z.string().min(1),
  zoneId: z.string().min(1),
  title: z.string().min(1),
  environmentAssetId: z.string().min(1).optional(),
  cameraStart: CameraPoseSchema.optional(),
  characterPlacements: z.array(CharacterPlacementSchema),
  interactableIds: z.array(z.string().min(1)),
  lightingPreset: WorldLightingPresetSchema.optional()
})

export const WorldArtDirectionSchema = z.object({
  style: WorldArtStyleSchema,
  mood: z.array(z.string().min(1)).min(1)
})

export const WorldDefinitionSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  artDirection: WorldArtDirectionSchema,
  zones: z.array(WorldZoneSchema).min(1),
  scenes: z.array(SceneDefinitionSchema).min(1),
  characters: z.array(CharacterDefinitionSchema),
  interactables: z.array(InteractableDefinitionSchema),
  assetManifestId: z.string().min(1).optional()
})

export const WorldBindingReferenceSchema = z.object({
  worldId: z.string().min(1),
  entrySceneId: z.string().min(1)
})

export const WorldRuntimeStateSchema = z.object({
  worldId: z.string().min(1),
  worldVersion: z.string().min(1),
  activeSceneId: z.string().min(1),
  visitedSceneIds: z.array(z.string().min(1)),
  completedInteractableIds: z.array(z.string().min(1)),
  flags: z.record(z.union([z.boolean(), z.string(), z.number()]))
})

export const WorldRuntimeStateChangedEventSchema = z.object({
  type: z.literal('WORLD_STATE_CHANGED'),
  state: WorldRuntimeStateSchema
})

export const WorldRuntimeToRendererEventSchema =
  WorldRuntimeStateChangedEventSchema

export const WorldInteractableClickedEventSchema = z.object({
  type: z.literal('INTERACTABLE_CLICKED'),
  interactableId: z.string().min(1)
})

export const WorldObjectObservedEventSchema = z.object({
  type: z.literal('WORLD_OBJECT_OBSERVED'),
  interactableId: z.string().min(1)
})

export const WorldCutsceneCompletedEventSchema = z.object({
  type: z.literal('CUTSCENE_COMPLETED'),
  cutsceneId: z.string().min(1)
})

export const WorldActivityCompletedEventSchema = z.object({
  type: z.literal('WORLD_ACTIVITY_COMPLETED'),
  activityId: z.string().min(1),
  payload: z.record(z.unknown()).optional()
})

export const WorldRendererToRuntimeEventSchema = z.discriminatedUnion('type', [
  WorldInteractableClickedEventSchema,
  WorldObjectObservedEventSchema,
  WorldCutsceneCompletedEventSchema,
  WorldActivityCompletedEventSchema
])
