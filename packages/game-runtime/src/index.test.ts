import { describe, expect, it } from 'vitest'
import type { NarrativeDefinition } from '@sel-quest/narrative-core'
import type { WorldDefinition } from '@sel-quest/world-core'
import {
  GameBridge,
  createInitialWorldNarrativeRuntime,
  handleWorldNarrativeRuntimeEvent,
  validateGameBridgeToGameEvent,
  validateQuestRendererEvent,
  validateRendererPublicQuestState
} from './index'

const publicQuestState = {
  currentStageId: 'intro',
  currentActivityId: 'dialogue_intro',
  completedStageIds: ['welcome'],
  completedActivityIds: ['safety_notice'],
  flags: {
    safety_notice_shown: true
  }
}

describe('game-runtime event validation', () => {
  it('validates public quest state for renderers', () => {
    expect(validateRendererPublicQuestState(publicQuestState)).toEqual(
      publicQuestState
    )

    expect(() =>
      validateRendererPublicQuestState({
        ...publicQuestState,
        currentStageId: ''
      })
    ).toThrow()
  })

  it('validates quest renderer events', () => {
    expect(
      validateQuestRendererEvent({
        type: 'MAP_NODE_CLICKED',
        payload: {
          stageId: 'scenario_choice'
        }
      })
    ).toEqual({
      type: 'MAP_NODE_CLICKED',
      payload: {
        stageId: 'scenario_choice'
      }
    })

    expect(() =>
      validateQuestRendererEvent({
        type: 'UNKNOWN_RENDERER_EVENT'
      })
    ).toThrow()
  })

  it('validates bridge-to-game state events', () => {
    expect(
      validateGameBridgeToGameEvent({
        type: 'QUEST_STATE_CHANGED',
        state: publicQuestState
      })
    ).toEqual({
      type: 'QUEST_STATE_CHANGED',
      state: publicQuestState
    })

    expect(() =>
      validateGameBridgeToGameEvent({
        type: 'QUEST_STATE_CHANGED',
        state: {
          ...publicQuestState,
          completedStageIds: ['']
        }
      })
    ).toThrow()
  })

  it('validates game bridge events before dispatching them', () => {
    const bridge = new GameBridge()
    const questEvents: unknown[] = []
    const gameEvents: unknown[] = []

    bridge.onQuestEvent((event) => questEvents.push(event))
    bridge.onGameEvent((event) => gameEvents.push(event))

    bridge.sendToQuest({
      type: 'MAP_NODE_CLICKED',
      payload: {
        stageId: 'intro'
      }
    })
    bridge.sendToGame({
      type: 'QUEST_STATE_CHANGED',
      state: publicQuestState
    })

    expect(questEvents).toEqual([
      {
        type: 'MAP_NODE_CLICKED',
        payload: {
          stageId: 'intro'
        }
      }
    ])
    expect(gameEvents).toEqual([
      {
        type: 'QUEST_STATE_CHANGED',
        state: publicQuestState
      }
    ])

    expect(() =>
      bridge.sendToQuest({
        type: 'UNKNOWN_RENDERER_EVENT'
      } as never)
    ).toThrow()

    expect(() =>
      bridge.sendToGame({
        type: 'QUEST_STATE_CHANGED',
        state: {
          ...publicQuestState,
          completedActivityIds: ['']
        }
      })
    ).toThrow()
  })
})

const world: WorldDefinition = {
  id: 'emotion-town',
  version: '0.1.0',
  title: 'Emotion Town',
  artDirection: {
    style: 'storybook_3d',
    mood: ['warm']
  },
  zones: [
    {
      id: 'emotion_harbor',
      title: 'Emotion Harbor',
      theme: 'emotion_harbor',
      sceneIds: ['art_room', 'calm_room']
    }
  ],
  scenes: [
    {
      id: 'art_room',
      zoneId: 'emotion_harbor',
      title: 'Art Room',
      characterPlacements: [],
      interactableIds: ['crumpled_drawing', 'xiaoyu_npc']
    },
    {
      id: 'calm_room',
      zoneId: 'emotion_harbor',
      title: 'Calm Room',
      characterPlacements: [],
      interactableIds: []
    }
  ],
  characters: [],
  interactables: [
    {
      id: 'crumpled_drawing',
      sceneId: 'art_room',
      type: 'emotion_clue',
      label: 'Crumpled drawing',
      position: [0, 0, 0],
      radius: 0.8,
      onInteract: [
        {
          type: 'set_world_flag',
          flag: 'observed_crumpled_drawing',
          value: true
        }
      ]
    },
    {
      id: 'xiaoyu_npc',
      sceneId: 'art_room',
      type: 'choice_node',
      label: 'Xiaoyu',
      position: [1, 0, 0],
      radius: 1,
      onInteract: [
        {
          type: 'start_activity',
          activityId: 'dialogue_intro'
        }
      ]
    }
  ]
}

const narrative: NarrativeDefinition = {
  id: 'emotion-detective-narrative',
  questId: 'emotion-detective',
  version: '0.1.0',
  episodes: [
    {
      id: 'episode_xiaoyu_drawing',
      questId: 'emotion-detective',
      title: 'Xiaoyu and the drawing',
      summary: 'Observe a clue, name the feeling, then recap.',
      worldZoneId: 'emotion_harbor',
      entrySceneId: 'art_room',
      learningObjectiveIds: ['lo_emotion_recognition'],
      beats: [
        {
          id: 'beat_cutscene',
          kind: 'cutscene',
          sceneId: 'art_room',
          cutsceneId: 'cutscene_intro',
          learningObjectiveIds: ['lo_emotion_recognition'],
          next: 'beat_observe_drawing'
        },
        {
          id: 'beat_observe_drawing',
          kind: 'world_interaction',
          sceneId: 'art_room',
          interactableId: 'crumpled_drawing',
          learningObjectiveIds: ['lo_emotion_recognition'],
          next: 'beat_emotion_choice'
        },
        {
          id: 'beat_emotion_choice',
          kind: 'activity',
          sceneId: 'art_room',
          activityId: 'emotion_choice_001',
          learningObjectiveIds: ['lo_emotion_recognition'],
          next: 'beat_recap'
        },
        {
          id: 'beat_recap',
          kind: 'recap',
          sceneId: 'art_room',
          activityId: 'recap_001',
          learningObjectiveIds: ['lo_emotion_recognition']
        }
      ]
    }
  ],
  dialogues: [],
  cutscenes: [
    {
      id: 'cutscene_intro',
      sceneId: 'art_room',
      skippable: true,
      replayable: true,
      tracks: [],
      learningObjectiveIds: ['lo_emotion_recognition']
    }
  ]
}

describe('game-runtime world/narrative adapter', () => {
  it('creates initial world and narrative state with first beat intents', () => {
    const result = createInitialWorldNarrativeRuntime({
      world,
      narrative,
      entrySceneId: 'art_room'
    })

    expect(result.state.worldState).toMatchObject({
      worldId: 'emotion-town',
      activeSceneId: 'art_room'
    })
    expect(result.state.narrativeState).toMatchObject({
      narrativeId: 'emotion-detective-narrative',
      currentBeatId: 'beat_cutscene'
    })
    expect(result.narrativeIntents).toEqual([
      {
        type: 'play_cutscene',
        cutsceneId: 'cutscene_intro',
        beatId: 'beat_cutscene'
      }
    ])
  })

  it('defaults the active world scene to the current narrative beat scene', () => {
    const multiSceneNarrative: NarrativeDefinition = {
      ...narrative,
      episodes: [
        {
          ...narrative.episodes[0],
          beats: narrative.episodes[0].beats.map((beat) =>
            beat.id === 'beat_emotion_choice'
              ? {
                  ...beat,
                  sceneId: 'calm_room'
                }
              : beat
          )
        }
      ]
    }

    const result = createInitialWorldNarrativeRuntime({
      world,
      narrative: multiSceneNarrative,
      beatId: 'beat_emotion_choice'
    })

    expect(result.state.worldState.activeSceneId).toBe('calm_room')
  })

  it('advances a world interaction beat into the next quest activity intent', () => {
    const initial = createInitialWorldNarrativeRuntime({
      world,
      narrative,
      entrySceneId: 'art_room',
      beatId: 'beat_observe_drawing'
    })

    const result = handleWorldNarrativeRuntimeEvent({
      world,
      narrative,
      state: initial.state,
      event: {
        type: 'INTERACTABLE_CLICKED',
        interactableId: 'crumpled_drawing'
      }
    })

    expect(result.state.worldState.flags.observed_crumpled_drawing).toBe(true)
    expect(result.state.worldState.completedInteractableIds).toEqual([
      'crumpled_drawing'
    ])
    expect(result.state.narrativeState).toMatchObject({
      currentBeatId: 'beat_emotion_choice',
      completedBeatIds: ['beat_observe_drawing']
    })
    expect(result.narrativeIntents).toEqual([
      {
        type: 'start_activity',
        activityId: 'emotion_choice_001',
        beatId: 'beat_emotion_choice'
      }
    ])
  })

  it('keeps narrative state unchanged for non-current world interactions', () => {
    const initial = createInitialWorldNarrativeRuntime({
      world,
      narrative,
      entrySceneId: 'art_room',
      beatId: 'beat_observe_drawing'
    })

    const result = handleWorldNarrativeRuntimeEvent({
      world,
      narrative,
      state: initial.state,
      event: {
        type: 'INTERACTABLE_CLICKED',
        interactableId: 'xiaoyu_npc'
      }
    })

    expect(result.state.narrativeState).toBe(initial.state.narrativeState)
    expect(result.worldIntents).toEqual([
      {
        type: 'start_activity',
        activityId: 'dialogue_intro',
        sourceInteractableId: 'xiaoyu_npc'
      }
    ])
    expect(result.narrativeIntents).toEqual([])
  })

  it('advances cutscene and activity completion events through narrative beats', () => {
    const cutsceneRuntime = createInitialWorldNarrativeRuntime({
      world,
      narrative,
      entrySceneId: 'art_room'
    })

    const observedRuntime = handleWorldNarrativeRuntimeEvent({
      world,
      narrative,
      state: cutsceneRuntime.state,
      event: {
        type: 'CUTSCENE_COMPLETED',
        cutsceneId: 'cutscene_intro'
      }
    })

    expect(observedRuntime.state.narrativeState.currentBeatId).toBe(
      'beat_observe_drawing'
    )
    expect(observedRuntime.narrativeIntents).toEqual([
      {
        type: 'wait_for_interactable',
        interactableId: 'crumpled_drawing',
        beatId: 'beat_observe_drawing'
      }
    ])

    const activityRuntime = createInitialWorldNarrativeRuntime({
      world,
      narrative,
      entrySceneId: 'art_room',
      beatId: 'beat_emotion_choice'
    })
    const recapRuntime = handleWorldNarrativeRuntimeEvent({
      world,
      narrative,
      state: activityRuntime.state,
      event: {
        type: 'WORLD_ACTIVITY_COMPLETED',
        activityId: 'emotion_choice_001'
      }
    })

    expect(recapRuntime.state.narrativeState.currentBeatId).toBe('beat_recap')
    expect(recapRuntime.narrativeIntents).toEqual([
      {
        type: 'start_activity',
        activityId: 'recap_001',
        beatId: 'beat_recap'
      }
    ])
  })

  it('advances dialogue and scene transition completion events', () => {
    const dialogueNarrative: NarrativeDefinition = {
      ...narrative,
      episodes: [
        {
          ...narrative.episodes[0],
          beats: [
            {
              id: 'beat_dialogue',
              kind: 'dialogue',
              sceneId: 'art_room',
              dialogueId: 'dialogue_intro',
              learningObjectiveIds: ['lo_emotion_recognition'],
              next: 'beat_transition'
            },
            {
              id: 'beat_transition',
              kind: 'transition',
              sceneId: 'calm_room',
              learningObjectiveIds: ['lo_emotion_recognition'],
              next: 'beat_recap'
            },
            {
              id: 'beat_recap',
              kind: 'recap',
              sceneId: 'calm_room',
              activityId: 'recap_001',
              learningObjectiveIds: ['lo_emotion_recognition']
            }
          ]
        }
      ],
      dialogues: [
        {
          id: 'dialogue_intro',
          sceneId: 'art_room',
          lines: [
            {
              id: 'line_1',
              speakerId: 'guide',
              speakerRole: 'guide',
              speakerName: 'Guide',
              text: 'Let us move to a calmer room.'
            }
          ]
        }
      ]
    }
    const dialogueRuntime = createInitialWorldNarrativeRuntime({
      world,
      narrative: dialogueNarrative
    })

    const transitionRuntime = handleWorldNarrativeRuntimeEvent({
      world,
      narrative: dialogueNarrative,
      state: dialogueRuntime.state,
      event: {
        type: 'WORLD_DIALOGUE_COMPLETED',
        dialogueId: 'dialogue_intro'
      }
    })

    expect(transitionRuntime.state.narrativeState.currentBeatId).toBe(
      'beat_transition'
    )
    expect(transitionRuntime.narrativeIntents).toEqual([
      {
        type: 'transition_scene',
        sceneId: 'calm_room',
        beatId: 'beat_transition'
      }
    ])

    const recapRuntime = handleWorldNarrativeRuntimeEvent({
      world,
      narrative: dialogueNarrative,
      state: transitionRuntime.state,
      event: {
        type: 'WORLD_SCENE_TRANSITION_COMPLETED',
        sceneId: 'calm_room'
      }
    })

    expect(recapRuntime.state.worldState.activeSceneId).toBe('calm_room')
    expect(recapRuntime.state.narrativeState.currentBeatId).toBe('beat_recap')
    expect(recapRuntime.narrativeIntents).toEqual([
      {
        type: 'start_activity',
        activityId: 'recap_001',
        beatId: 'beat_recap'
      }
    ])
  })

  it('does not advance narrative state for mismatched completion events', () => {
    const activityRuntime = createInitialWorldNarrativeRuntime({
      world,
      narrative,
      entrySceneId: 'art_room',
      beatId: 'beat_emotion_choice'
    })

    const result = handleWorldNarrativeRuntimeEvent({
      world,
      narrative,
      state: activityRuntime.state,
      event: {
        type: 'WORLD_ACTIVITY_COMPLETED',
        activityId: 'other_activity'
      }
    })

    expect(result.state.narrativeState).toBe(activityRuntime.state.narrativeState)
    expect(result.narrativeIntents).toEqual([])
  })
})
