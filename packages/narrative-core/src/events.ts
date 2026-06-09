import type { NarrativeRuntimeState } from './types.ts'

export interface NarrativeStateChangedEvent {
  type: 'NARRATIVE_STATE_CHANGED'
  state: NarrativeRuntimeState
}

export interface NarrativeBeatEnteredEvent {
  type: 'NARRATIVE_BEAT_ENTERED'
  episodeId: string
  beatId: string
}

export interface NarrativeBeatCompletedEvent {
  type: 'NARRATIVE_BEAT_COMPLETED'
  episodeId: string
  beatId: string
}

export interface NarrativeDialogueCompletedEvent {
  type: 'NARRATIVE_DIALOGUE_COMPLETED'
  dialogueId: string
}

export interface NarrativeCutsceneCompletedEvent {
  type: 'NARRATIVE_CUTSCENE_COMPLETED'
  cutsceneId: string
}

export type NarrativeRuntimeEvent =
  | NarrativeStateChangedEvent
  | NarrativeBeatEnteredEvent
  | NarrativeBeatCompletedEvent
  | NarrativeDialogueCompletedEvent
  | NarrativeCutsceneCompletedEvent
