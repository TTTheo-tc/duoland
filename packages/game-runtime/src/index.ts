export interface QuestRuntimePublicState {
  currentStageId?: string
  currentActivityId?: string
  completedStageIds: string[]
  completedActivityIds: string[]
}

export interface GameBridgeToGameEvent {
  type: 'QUEST_STATE_CHANGED'
  state: QuestRuntimePublicState
}

export interface GameBridgeFromGameEvent {
  type: 'NPC_CLICKED' | 'MAP_NODE_CLICKED' | 'MINI_GAME_COMPLETED'
  payload?: Record<string, unknown>
}

type Listener<T> = (event: T) => void

export class GameBridge {
  private gameListeners = new Set<Listener<GameBridgeToGameEvent>>()
  private questListeners = new Set<Listener<GameBridgeFromGameEvent>>()

  sendToGame(event: GameBridgeToGameEvent): void {
    for (const listener of this.gameListeners) listener(event)
  }

  sendToQuest(event: GameBridgeFromGameEvent): void {
    for (const listener of this.questListeners) listener(event)
  }

  onGameEvent(listener: Listener<GameBridgeToGameEvent>): () => void {
    this.gameListeners.add(listener)
    return () => this.gameListeners.delete(listener)
  }

  onQuestEvent(listener: Listener<GameBridgeFromGameEvent>): () => void {
    this.questListeners.add(listener)
    return () => this.questListeners.delete(listener)
  }
}

export { PhaserCanvas } from './PhaserCanvas'
