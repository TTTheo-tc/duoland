export interface NarrativeDefinition {
  id: string
  questId: string
  version: string
  episodes: EpisodeDefinition[]
  dialogues: DialogueDefinition[]
  cutscenes: CutsceneDefinition[]
}

export interface EpisodeDefinition {
  id: string
  questId: string
  title: string
  summary: string
  worldZoneId: string
  entrySceneId: string
  learningObjectiveIds: string[]
  beats: NarrativeBeat[]
}

export type NarrativeBeatKind =
  | 'cutscene'
  | 'dialogue'
  | 'observe_scene'
  | 'world_interaction'
  | 'activity'
  | 'reflection'
  | 'recap'
  | 'transition'

export interface NarrativeBeat {
  id: string
  kind: NarrativeBeatKind
  sceneId?: string
  activityId?: string
  dialogueId?: string
  cutsceneId?: string
  interactableId?: string
  learningObjectiveIds: string[]
  enterActions?: NarrativeRuntimeAction[]
  exitActions?: NarrativeRuntimeAction[]
  next?: string | BranchRule[]
}

export type BranchRule =
  | {
      type: 'default'
      nextBeatId: string
    }
  | {
      type: 'world_flag'
      flag: string
      equals: boolean | string | number
      nextBeatId: string
    }
  | {
      type: 'activity_completed'
      activityId: string
      nextBeatId: string
    }

export type NarrativeRuntimeAction =
  | {
      type: 'set_world_flag'
      flag: string
      value: boolean | string | number
    }
  | {
      type: 'show_notice'
      noticeId: string
    }

export interface DialogueDefinition {
  id: string
  sceneId?: string
  lines: DialogueLine[]
}

export interface DialogueLine {
  id: string
  speakerId: string
  speakerRole: 'world_character' | 'guide' | 'narrator'
  speakerName: string
  text: string
  emotion?: 'neutral' | 'happy' | 'sad' | 'worried' | 'angry' | 'calm'
}

export interface CutsceneDefinition {
  id: string
  sceneId: string
  skippable: boolean
  replayable: boolean
  tracks: CutsceneTrack[]
  learningObjectiveIds: string[]
}

export type CutsceneTrack =
  | {
      type: 'camera'
      at: number
      duration: number
      action: 'moveTo' | 'lookAt' | 'zoom'
      params: Record<string, unknown>
    }
  | {
      type: 'character'
      characterId: string
      at: number
      duration?: number
      action: 'moveTo' | 'playAnimation' | 'setExpression'
      params: Record<string, unknown>
    }
  | {
      type: 'dialogue'
      dialogueId: string
      at: number
    }
  | {
      type: 'activity'
      activityId: string
      at: number
    }
  | {
      type: 'world'
      at: number
      action: 'setFlag' | 'changeLighting' | 'spawnObject' | 'hideObject'
      params: Record<string, unknown>
    }

export interface NarrativeRuntimeState {
  narrativeId: string
  episodeId: string
  currentBeatId: string
  completedBeatIds: string[]
  flags: Record<string, boolean | string | number>
}

export interface NarrativeReferenceContext {
  questId: string
  episodeIds?: Iterable<string>
  activityIds: Iterable<string>
  learningObjectiveIds: Iterable<string>
  worldZoneIds: Iterable<string>
  sceneIds: Iterable<string>
  interactableIds: Iterable<string>
  characterIds: Iterable<string>
}
