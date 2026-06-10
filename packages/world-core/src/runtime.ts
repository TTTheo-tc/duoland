import type {
  WorldAction,
  WorldDefinition,
  WorldRuntimeState
} from './types.ts'
import type { WorldRendererToRuntimeEvent } from './events.ts'
import {
  completeWorldInteractable,
  setWorldFlag,
  transitionWorldScene
} from './state.ts'

export type WorldRuntimeIntent =
  | {
      type: 'start_dialogue'
      dialogueId: string
      sourceInteractableId?: string
    }
  | {
      type: 'start_activity'
      activityId: string
      sourceInteractableId?: string
    }
  | {
      type: 'play_cutscene'
      cutsceneId: string
      sourceInteractableId?: string
    }
  | {
      type: 'transition_scene'
      sceneId: string
      sourceInteractableId?: string
    }

export interface WorldRuntimeStepResult {
  state: WorldRuntimeState
  intents: WorldRuntimeIntent[]
}

export function interpretWorldRendererEvent({
  world,
  state,
  event
}: {
  world: WorldDefinition
  state: WorldRuntimeState
  event: WorldRendererToRuntimeEvent
}): WorldRuntimeStepResult {
  if (
    event.type === 'INTERACTABLE_CLICKED' ||
    event.type === 'WORLD_OBJECT_OBSERVED'
  ) {
    return interpretWorldInteractable(world, state, event.interactableId)
  }

  if (event.type === 'WORLD_SCENE_TRANSITION_COMPLETED') {
    if (!world.scenes.some((scene) => scene.id === event.sceneId)) {
      throw new Error(`World scene does not exist: ${event.sceneId}`)
    }

    return {
      state: transitionWorldScene(state, event.sceneId),
      intents: []
    }
  }

  return { state, intents: [] }
}

export function interpretWorldInteractable(
  world: WorldDefinition,
  state: WorldRuntimeState,
  interactableId: string
): WorldRuntimeStepResult {
  const interactable = world.interactables.find(
    (candidate) => candidate.id === interactableId
  )

  if (!interactable) {
    throw new Error(`World interactable does not exist: ${interactableId}`)
  }

  if (interactable.sceneId !== state.activeSceneId) {
    throw new Error(
      `World interactable ${interactableId} is not in active scene ${state.activeSceneId}.`
    )
  }

  let nextState = completeWorldInteractable(state, interactableId)
  const intents: WorldRuntimeIntent[] = []

  for (const action of interactable.onInteract) {
    const result = applyWorldAction(nextState, action, interactableId)
    nextState = result.state
    intents.push(...result.intents)
  }

  return {
    state: nextState,
    intents
  }
}

export function applyWorldAction(
  state: WorldRuntimeState,
  action: WorldAction,
  sourceInteractableId?: string
): WorldRuntimeStepResult {
  switch (action.type) {
    case 'set_world_flag':
      return {
        state: setWorldFlag(state, action.flag, action.value),
        intents: []
      }
    case 'transition_scene':
      return {
        state: transitionWorldScene(state, action.sceneId),
        intents: [
          {
            type: 'transition_scene',
            sceneId: action.sceneId,
            sourceInteractableId
          }
        ]
      }
    case 'start_activity':
      return {
        state,
        intents: [
          {
            type: 'start_activity',
            activityId: action.activityId,
            sourceInteractableId
          }
        ]
      }
    case 'start_dialogue':
      return {
        state,
        intents: [
          {
            type: 'start_dialogue',
            dialogueId: action.dialogueId,
            sourceInteractableId
          }
        ]
      }
    case 'play_cutscene':
      return {
        state,
        intents: [
          {
            type: 'play_cutscene',
            cutsceneId: action.cutsceneId,
            sourceInteractableId
          }
        ]
      }
  }
}
