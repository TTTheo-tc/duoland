import type { WorldRuntimeState } from './types.ts'
import {
  WorldRendererToRuntimeEventSchema,
  WorldRuntimeToRendererEventSchema
} from './schema.ts'

export interface WorldRuntimeStateChangedEvent {
  type: 'WORLD_STATE_CHANGED'
  state: WorldRuntimeState
}

export interface WorldInteractableClickedEvent {
  type: 'INTERACTABLE_CLICKED'
  interactableId: string
}

export interface WorldObjectObservedEvent {
  type: 'WORLD_OBJECT_OBSERVED'
  interactableId: string
}

export interface WorldCutsceneCompletedEvent {
  type: 'CUTSCENE_COMPLETED'
  cutsceneId: string
}

export interface WorldActivityCompletedEvent {
  type: 'WORLD_ACTIVITY_COMPLETED'
  activityId: string
  payload?: Record<string, unknown>
}

export type WorldRuntimeToRendererEvent = WorldRuntimeStateChangedEvent

export type WorldRendererToRuntimeEvent =
  | WorldInteractableClickedEvent
  | WorldObjectObservedEvent
  | WorldCutsceneCompletedEvent
  | WorldActivityCompletedEvent

export function validateWorldRuntimeToRendererEvent(
  input: unknown
): WorldRuntimeToRendererEvent {
  return WorldRuntimeToRendererEventSchema.parse(
    input
  ) as WorldRuntimeToRendererEvent
}

export function validateWorldRendererToRuntimeEvent(
  input: unknown
): WorldRendererToRuntimeEvent {
  return WorldRendererToRuntimeEventSchema.parse(
    input
  ) as WorldRendererToRuntimeEvent
}
