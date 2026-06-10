import type {
  BranchRule,
  NarrativeBeat,
  NarrativeDefinition,
  NarrativeRuntimeAction,
  NarrativeRuntimeState
} from './types.ts'
import type { NarrativeRuntimeEvent } from './events.ts'
import {
  completeNarrativeBeat,
  transitionNarrativeBeat
} from './state.ts'

export type NarrativeRuntimeIntent =
  | {
      type: 'start_activity'
      activityId: string
      beatId: string
    }
  | {
      type: 'start_dialogue'
      dialogueId: string
      beatId: string
    }
  | {
      type: 'play_cutscene'
      cutsceneId: string
      beatId: string
    }
  | {
      type: 'wait_for_interactable'
      interactableId: string
      beatId: string
    }
  | {
      type: 'transition_scene'
      sceneId: string
      beatId: string
    }
  | {
      type: 'set_world_flag'
      flag: string
      value: boolean | string | number
      beatId: string
    }
  | {
      type: 'show_notice'
      noticeId: string
      beatId: string
    }

export interface NarrativeRuntimeContext {
  worldFlags?: Record<string, boolean | string | number>
  completedActivityIds?: Iterable<string>
}

export interface NarrativeRuntimeStepResult {
  state: NarrativeRuntimeState
  intents: NarrativeRuntimeIntent[]
  events: NarrativeRuntimeEvent[]
}

export function getCurrentNarrativeBeat(
  narrative: NarrativeDefinition,
  state: NarrativeRuntimeState
): NarrativeBeat {
  const episode = narrative.episodes.find(
    (candidate) => candidate.id === state.episodeId
  )

  if (!episode) {
    throw new Error(`Narrative episode does not exist: ${state.episodeId}`)
  }

  const beat = episode.beats.find(
    (candidate) => candidate.id === state.currentBeatId
  )

  if (!beat) {
    throw new Error(`Narrative beat does not exist: ${state.currentBeatId}`)
  }

  return beat
}

export function getNarrativeBeatIntents(
  beat: NarrativeBeat
): NarrativeRuntimeIntent[] {
  const intents = [
    ...toActionIntents(beat.enterActions ?? [], beat.id),
    ...toBeatIntents(beat)
  ]

  return intents
}

export function completeAndAdvanceNarrativeBeat(
  narrative: NarrativeDefinition,
  state: NarrativeRuntimeState,
  context: NarrativeRuntimeContext = {}
): NarrativeRuntimeStepResult {
  const currentBeat = getCurrentNarrativeBeat(narrative, state)
  let nextState = completeNarrativeBeat(state, currentBeat.id)
  // Exit actions are emitted for the runtime adapter to apply; branch rules use
  // only the external context provided with this step.
  const exitIntents = toActionIntents(currentBeat.exitActions ?? [], currentBeat.id)
  const events: NarrativeRuntimeEvent[] = [
    {
      type: 'NARRATIVE_BEAT_COMPLETED',
      episodeId: state.episodeId,
      beatId: currentBeat.id
    }
  ]

  const nextBeatId = resolveNextNarrativeBeatId(currentBeat, context)
  if (!nextBeatId) {
    return {
      state: nextState,
      intents: exitIntents,
      events: [
        ...events,
        {
          type: 'NARRATIVE_STATE_CHANGED',
          state: nextState
        }
      ]
    }
  }

  nextState = transitionNarrativeBeat(nextState, nextBeatId)
  const nextBeat = getCurrentNarrativeBeat(narrative, nextState)
  const intents = [...exitIntents, ...getNarrativeBeatIntents(nextBeat)]

  return {
    state: nextState,
    intents,
    events: [
      ...events,
      {
        type: 'NARRATIVE_BEAT_ENTERED',
        episodeId: nextState.episodeId,
        beatId: nextBeat.id
      },
      {
        type: 'NARRATIVE_STATE_CHANGED',
        state: nextState
      }
    ]
  }
}

export function resolveNextNarrativeBeatId(
  beat: NarrativeBeat,
  context: NarrativeRuntimeContext = {}
): string | undefined {
  if (!beat.next) return undefined
  if (typeof beat.next === 'string') return beat.next

  const defaultRule = beat.next.find((rule) => rule.type === 'default')

  for (const rule of beat.next) {
    if (rule.type !== 'default' && branchRuleMatches(rule, context)) {
      return rule.nextBeatId
    }
  }

  return defaultRule?.nextBeatId
}

function toBeatIntents(beat: NarrativeBeat): NarrativeRuntimeIntent[] {
  if (beat.kind === 'cutscene' && beat.cutsceneId) {
    return [{ type: 'play_cutscene', cutsceneId: beat.cutsceneId, beatId: beat.id }]
  }

  if (beat.kind === 'dialogue' && beat.dialogueId) {
    return [{ type: 'start_dialogue', dialogueId: beat.dialogueId, beatId: beat.id }]
  }

  if (beat.kind === 'world_interaction' && beat.interactableId) {
    return [
      {
        type: 'wait_for_interactable',
        interactableId: beat.interactableId,
        beatId: beat.id
      }
    ]
  }

  if (beat.sceneId && beat.kind === 'transition') {
    return [{ type: 'transition_scene', sceneId: beat.sceneId, beatId: beat.id }]
  }

  if (
    (beat.kind === 'activity' ||
      beat.kind === 'reflection' ||
      beat.kind === 'recap') &&
    beat.activityId
  ) {
    return [{ type: 'start_activity', activityId: beat.activityId, beatId: beat.id }]
  }

  return []
}

function toActionIntents(
  actions: NarrativeRuntimeAction[],
  beatId: string
): NarrativeRuntimeIntent[] {
  return actions.map((action) => {
    if (action.type === 'set_world_flag') {
      return {
        type: 'set_world_flag',
        flag: action.flag,
        value: action.value,
        beatId
      }
    }

    return {
      type: 'show_notice',
      noticeId: action.noticeId,
      beatId
    }
  })
}

function branchRuleMatches(
  rule: Exclude<BranchRule, { type: 'default' }>,
  context: NarrativeRuntimeContext
) {
  if (rule.type === 'world_flag') {
    return context.worldFlags?.[rule.flag] === rule.equals
  }

  return toSet(context.completedActivityIds ?? []).has(rule.activityId)
}

function toSet(values: Iterable<string>) {
  return values instanceof Set ? values : new Set(values)
}
