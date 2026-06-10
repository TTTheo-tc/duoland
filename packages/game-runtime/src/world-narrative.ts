import {
  completeAndAdvanceNarrativeBeat,
  createInitialNarrativeState,
  getCurrentNarrativeBeat,
  getNarrativeBeatIntents,
  type NarrativeDefinition,
  type EpisodeDefinition,
  type NarrativeRuntimeEvent,
  type NarrativeRuntimeIntent,
  type NarrativeRuntimeState
} from '@sel-quest/narrative-core'
import {
  createInitialWorldState,
  interpretWorldRendererEvent,
  type WorldDefinition,
  type WorldRendererToRuntimeEvent,
  type WorldRuntimeIntent,
  type WorldRuntimeState
} from '@sel-quest/world-core'

export interface WorldNarrativeRuntimeState {
  worldState: WorldRuntimeState
  narrativeState: NarrativeRuntimeState
}

export interface WorldNarrativeRuntimeStepResult {
  state: WorldNarrativeRuntimeState
  worldIntents: WorldRuntimeIntent[]
  narrativeIntents: NarrativeRuntimeIntent[]
  narrativeEvents: NarrativeRuntimeEvent[]
}

export function createInitialWorldNarrativeRuntime({
  world,
  narrative,
  entrySceneId,
  episodeId,
  beatId
}: {
  world: WorldDefinition
  narrative: NarrativeDefinition
  entrySceneId?: string
  episodeId?: string
  beatId?: string
}): WorldNarrativeRuntimeStepResult {
  const narrativeState = createInitialNarrativeState(narrative, {
    episodeId,
    beatId
  })
  const beat = getCurrentNarrativeBeat(narrative, narrativeState)
  const episode = getRuntimeEpisode(narrative, narrativeState)
  const worldState = createInitialWorldState(world, {
    entrySceneId: entrySceneId ?? beat.sceneId ?? episode.entrySceneId
  })

  return {
    state: {
      worldState,
      narrativeState
    },
    worldIntents: [],
    narrativeIntents: getNarrativeBeatIntents(beat),
    narrativeEvents: [
      {
        type: 'NARRATIVE_BEAT_ENTERED',
        episodeId: narrativeState.episodeId,
        beatId: narrativeState.currentBeatId
      },
      {
        type: 'NARRATIVE_STATE_CHANGED',
        state: narrativeState
      }
    ]
  }
}

export function handleWorldNarrativeRuntimeEvent({
  world,
  narrative,
  state,
  event,
  completedActivityIds = []
}: {
  world: WorldDefinition
  narrative: NarrativeDefinition
  state: WorldNarrativeRuntimeState
  event: WorldRendererToRuntimeEvent
  completedActivityIds?: Iterable<string>
}): WorldNarrativeRuntimeStepResult {
  const worldResult = interpretWorldRendererEvent({
    world,
    state: state.worldState,
    event
  })
  const narrativeResult = shouldAdvanceNarrativeForEvent(
    narrative,
    state.narrativeState,
    event
  )
    ? completeAndAdvanceNarrativeBeat(narrative, state.narrativeState, {
        worldFlags: worldResult.state.flags,
        completedActivityIds: collectCompletedActivityIds(
          completedActivityIds,
          event
        )
      })
    : {
        state: state.narrativeState,
        intents: [],
        events: []
      }

  return {
    state: {
      worldState: worldResult.state,
      narrativeState: narrativeResult.state
    },
    worldIntents: worldResult.intents,
    narrativeIntents: narrativeResult.intents,
    narrativeEvents: narrativeResult.events
  }
}

function shouldAdvanceNarrativeForEvent(
  narrative: NarrativeDefinition,
  state: NarrativeRuntimeState,
  event: WorldRendererToRuntimeEvent
) {
  const beat = getCurrentNarrativeBeat(narrative, state)

  if (
    (event.type === 'INTERACTABLE_CLICKED' ||
      event.type === 'WORLD_OBJECT_OBSERVED') &&
    beat.kind === 'world_interaction'
  ) {
    return beat.interactableId === event.interactableId
  }

  if (event.type === 'CUTSCENE_COMPLETED' && beat.kind === 'cutscene') {
    return beat.cutsceneId === event.cutsceneId
  }

  if (event.type === 'WORLD_DIALOGUE_COMPLETED' && beat.kind === 'dialogue') {
    return beat.dialogueId === event.dialogueId
  }

  if (
    event.type === 'WORLD_SCENE_TRANSITION_COMPLETED' &&
    beat.kind === 'transition'
  ) {
    return beat.sceneId === event.sceneId
  }

  if (
    event.type === 'WORLD_ACTIVITY_COMPLETED' &&
    (beat.kind === 'activity' ||
      beat.kind === 'reflection' ||
      beat.kind === 'recap')
  ) {
    return beat.activityId === event.activityId
  }

  return false
}

function getRuntimeEpisode(
  narrative: NarrativeDefinition,
  state: NarrativeRuntimeState
): EpisodeDefinition {
  const episode = narrative.episodes.find(
    (candidate) => candidate.id === state.episodeId
  )

  if (!episode) {
    throw new Error(`Narrative episode does not exist: ${state.episodeId}`)
  }

  return episode
}

function collectCompletedActivityIds(
  completedActivityIds: Iterable<string>,
  event: WorldRendererToRuntimeEvent
) {
  const values = new Set(completedActivityIds)
  if (event.type === 'WORLD_ACTIVITY_COMPLETED') {
    values.add(event.activityId)
  }

  return values
}
