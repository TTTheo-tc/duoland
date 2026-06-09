import type { WorldDefinition, WorldRuntimeState } from './types.ts'

export function createInitialWorldState(
  world: WorldDefinition,
  options: { entrySceneId?: string } = {}
): WorldRuntimeState {
  const activeSceneId = options.entrySceneId ?? world.scenes[0]?.id

  if (!activeSceneId) {
    throw new Error('World must include at least one scene.')
  }

  if (!world.scenes.some((scene) => scene.id === activeSceneId)) {
    throw new Error(`World entry scene does not exist: ${activeSceneId}`)
  }

  return {
    worldId: world.id,
    worldVersion: world.version,
    activeSceneId,
    visitedSceneIds: [activeSceneId],
    completedInteractableIds: [],
    flags: {}
  }
}

export function transitionWorldScene(
  state: WorldRuntimeState,
  sceneId: string
): WorldRuntimeState {
  return {
    ...state,
    activeSceneId: sceneId,
    visitedSceneIds: appendUnique(state.visitedSceneIds, sceneId)
  }
}

export function completeWorldInteractable(
  state: WorldRuntimeState,
  interactableId: string
): WorldRuntimeState {
  return {
    ...state,
    completedInteractableIds: appendUnique(
      state.completedInteractableIds,
      interactableId
    )
  }
}

export function setWorldFlag(
  state: WorldRuntimeState,
  flag: string,
  value: boolean | string | number
): WorldRuntimeState {
  return {
    ...state,
    flags: {
      ...state.flags,
      [flag]: value
    }
  }
}

function appendUnique(values: string[], value: string) {
  return values.includes(value) ? values : [...values, value]
}
