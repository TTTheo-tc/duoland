import { z } from 'zod'

export const NarrativeRuntimeActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('set_world_flag'),
    flag: z.string().min(1),
    value: z.union([z.boolean(), z.string(), z.number()])
  }),
  z.object({
    type: z.literal('show_notice'),
    noticeId: z.string().min(1)
  })
])

export const BranchRuleSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('default'),
    nextBeatId: z.string().min(1)
  }),
  z.object({
    type: z.literal('world_flag'),
    flag: z.string().min(1),
    equals: z.union([z.boolean(), z.string(), z.number()]),
    nextBeatId: z.string().min(1)
  }),
  z.object({
    type: z.literal('activity_completed'),
    activityId: z.string().min(1),
    nextBeatId: z.string().min(1)
  })
])

export const NarrativeBeatKindSchema = z.enum([
  'cutscene',
  'dialogue',
  'observe_scene',
  'world_interaction',
  'activity',
  'reflection',
  'recap',
  'transition'
])

export const NarrativeBeatSchema = z.object({
  id: z.string().min(1),
  kind: NarrativeBeatKindSchema,
  sceneId: z.string().min(1).optional(),
  activityId: z.string().min(1).optional(),
  dialogueId: z.string().min(1).optional(),
  cutsceneId: z.string().min(1).optional(),
  interactableId: z.string().min(1).optional(),
  learningObjectiveIds: z.array(z.string().min(1)).min(1),
  enterActions: z.array(NarrativeRuntimeActionSchema).optional(),
  exitActions: z.array(NarrativeRuntimeActionSchema).optional(),
  next: z.union([z.string().min(1), z.array(BranchRuleSchema).min(1)]).optional()
})

export const EpisodeDefinitionSchema = z.object({
  id: z.string().min(1),
  questId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  worldZoneId: z.string().min(1),
  entrySceneId: z.string().min(1),
  learningObjectiveIds: z.array(z.string().min(1)).min(1),
  beats: z.array(NarrativeBeatSchema).min(1)
})

export const DialogueLineSchema = z.object({
  id: z.string().min(1),
  speakerId: z.string().min(1),
  speakerRole: z.enum(['world_character', 'guide', 'narrator']),
  speakerName: z.string().min(1),
  text: z.string().min(1),
  emotion: z
    .enum(['neutral', 'happy', 'sad', 'worried', 'angry', 'calm'])
    .optional()
})

export const DialogueDefinitionSchema = z.object({
  id: z.string().min(1),
  sceneId: z.string().min(1).optional(),
  lines: z.array(DialogueLineSchema).min(1)
})

export const CutsceneTrackSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('camera'),
    at: z.number().nonnegative(),
    duration: z.number().nonnegative(),
    action: z.enum(['moveTo', 'lookAt', 'zoom']),
    params: z.record(z.unknown())
  }),
  z.object({
    type: z.literal('character'),
    characterId: z.string().min(1),
    at: z.number().nonnegative(),
    duration: z.number().nonnegative().optional(),
    action: z.enum(['moveTo', 'playAnimation', 'setExpression']),
    params: z.record(z.unknown())
  }),
  z.object({
    type: z.literal('dialogue'),
    dialogueId: z.string().min(1),
    at: z.number().nonnegative()
  }),
  z.object({
    type: z.literal('activity'),
    activityId: z.string().min(1),
    at: z.number().nonnegative()
  }),
  z.object({
    type: z.literal('world'),
    at: z.number().nonnegative(),
    action: z.enum(['setFlag', 'changeLighting', 'spawnObject', 'hideObject']),
    params: z.record(z.unknown())
  })
])

export const CutsceneDefinitionSchema = z.object({
  id: z.string().min(1),
  sceneId: z.string().min(1),
  skippable: z.boolean(),
  replayable: z.boolean(),
  tracks: z.array(CutsceneTrackSchema),
  learningObjectiveIds: z.array(z.string().min(1)).min(1)
})

export const NarrativeDefinitionSchema = z.object({
  id: z.string().min(1),
  questId: z.string().min(1),
  version: z.string().min(1),
  episodes: z.array(EpisodeDefinitionSchema).min(1),
  dialogues: z.array(DialogueDefinitionSchema),
  cutscenes: z.array(CutsceneDefinitionSchema)
})

export const NarrativeRuntimeStateSchema = z.object({
  narrativeId: z.string().min(1),
  episodeId: z.string().min(1),
  currentBeatId: z.string().min(1),
  completedBeatIds: z.array(z.string().min(1)),
  flags: z.record(z.union([z.boolean(), z.string(), z.number()]))
})

export const NarrativeStateChangedEventSchema = z.object({
  type: z.literal('NARRATIVE_STATE_CHANGED'),
  state: NarrativeRuntimeStateSchema
})

export const NarrativeBeatEnteredEventSchema = z.object({
  type: z.literal('NARRATIVE_BEAT_ENTERED'),
  episodeId: z.string().min(1),
  beatId: z.string().min(1)
})

export const NarrativeBeatCompletedEventSchema = z.object({
  type: z.literal('NARRATIVE_BEAT_COMPLETED'),
  episodeId: z.string().min(1),
  beatId: z.string().min(1)
})

export const NarrativeDialogueCompletedEventSchema = z.object({
  type: z.literal('NARRATIVE_DIALOGUE_COMPLETED'),
  dialogueId: z.string().min(1)
})

export const NarrativeCutsceneCompletedEventSchema = z.object({
  type: z.literal('NARRATIVE_CUTSCENE_COMPLETED'),
  cutsceneId: z.string().min(1)
})

export const NarrativeRuntimeEventSchema = z.discriminatedUnion('type', [
  NarrativeStateChangedEventSchema,
  NarrativeBeatEnteredEventSchema,
  NarrativeBeatCompletedEventSchema,
  NarrativeDialogueCompletedEventSchema,
  NarrativeCutsceneCompletedEventSchema
])
