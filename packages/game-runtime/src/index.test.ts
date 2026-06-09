import { describe, expect, it } from 'vitest'
import {
  GameBridge,
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
