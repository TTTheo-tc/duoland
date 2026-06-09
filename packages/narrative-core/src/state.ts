import type {
  EpisodeDefinition,
  NarrativeDefinition,
  NarrativeRuntimeState
} from './types.ts'

export function createInitialNarrativeState(
  narrative: NarrativeDefinition,
  options: { episodeId?: string; beatId?: string } = {}
): NarrativeRuntimeState {
  const episode = resolveEpisode(narrative, options.episodeId)
  const currentBeatId = options.beatId ?? episode.beats[0]?.id

  if (!currentBeatId) {
    throw new Error(`Episode ${episode.id} must include at least one beat.`)
  }

  if (!episode.beats.some((beat) => beat.id === currentBeatId)) {
    throw new Error(`Narrative entry beat does not exist: ${currentBeatId}`)
  }

  return {
    narrativeId: narrative.id,
    episodeId: episode.id,
    currentBeatId,
    completedBeatIds: [],
    flags: {}
  }
}

export function completeNarrativeBeat(
  state: NarrativeRuntimeState,
  beatId: string
): NarrativeRuntimeState {
  return {
    ...state,
    completedBeatIds: appendUnique(state.completedBeatIds, beatId)
  }
}

export function transitionNarrativeBeat(
  state: NarrativeRuntimeState,
  beatId: string
): NarrativeRuntimeState {
  return {
    ...state,
    currentBeatId: beatId
  }
}

export function setNarrativeFlag(
  state: NarrativeRuntimeState,
  flag: string,
  value: boolean | string | number
): NarrativeRuntimeState {
  return {
    ...state,
    flags: {
      ...state.flags,
      [flag]: value
    }
  }
}

function resolveEpisode(
  narrative: NarrativeDefinition,
  episodeId?: string
): EpisodeDefinition {
  const episode = episodeId
    ? narrative.episodes.find((candidate) => candidate.id === episodeId)
    : narrative.episodes[0]

  if (!episode) {
    throw new Error(`Narrative episode does not exist: ${episodeId ?? '<first>'}`)
  }

  return episode
}

function appendUnique(values: string[], value: string) {
  return values.includes(value) ? values : [...values, value]
}
