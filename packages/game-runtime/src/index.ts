export interface RendererPublicQuestState {
  currentStageId?: string
  currentActivityId?: string
  completedStageIds: string[]
  completedActivityIds: string[]
  flags: Record<string, boolean | string | number>
}

export type QuestRuntimePublicState = RendererPublicQuestState

export interface QuestRendererEvent {
  type:
    | 'INTERACTABLE_CLICKED'
    | 'MAP_NODE_CLICKED'
    | 'MINI_GAME_COMPLETED'
    | 'CUTSCENE_COMPLETED'
    | 'WORLD_OBJECT_OBSERVED'
  payload?: Record<string, unknown>
}

export interface GameBridgeToGameEvent {
  type: 'QUEST_STATE_CHANGED'
  state: RendererPublicQuestState
}

export type GameBridgeFromGameEvent = QuestRendererEvent

export interface QuestRendererProps<TQuest> {
  quest: TQuest
  questState: RendererPublicQuestState
  onRendererEvent?: (event: QuestRendererEvent) => void
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
