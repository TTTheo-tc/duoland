import { z } from 'zod'

export * from './world-narrative.ts'

const RendererFlagValueSchema = z.union([z.boolean(), z.string(), z.number()])

export const RendererPublicQuestStateSchema = z.object({
  currentStageId: z.string().min(1).optional(),
  currentActivityId: z.string().min(1).optional(),
  completedStageIds: z.array(z.string().min(1)),
  completedActivityIds: z.array(z.string().min(1)),
  flags: z.record(RendererFlagValueSchema)
})

export interface RendererPublicQuestState {
  currentStageId?: string
  currentActivityId?: string
  completedStageIds: string[]
  completedActivityIds: string[]
  flags: Record<string, boolean | string | number>
}

export type QuestRuntimePublicState = RendererPublicQuestState

export const QuestRendererEventSchema = z.object({
  type: z.enum([
    'INTERACTABLE_CLICKED',
    'MAP_NODE_CLICKED',
    'MINI_GAME_COMPLETED',
    'CUTSCENE_COMPLETED',
    'WORLD_OBJECT_OBSERVED'
  ]),
  payload: z.record(z.unknown()).optional()
})

export interface QuestRendererEvent {
  type:
    | 'INTERACTABLE_CLICKED'
    | 'MAP_NODE_CLICKED'
    | 'MINI_GAME_COMPLETED'
    | 'CUTSCENE_COMPLETED'
    | 'WORLD_OBJECT_OBSERVED'
  payload?: Record<string, unknown>
}

export const GameBridgeToGameEventSchema = z.object({
  type: z.literal('QUEST_STATE_CHANGED'),
  state: RendererPublicQuestStateSchema
})

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

export function validateRendererPublicQuestState(
  input: unknown
): RendererPublicQuestState {
  return RendererPublicQuestStateSchema.parse(input) as RendererPublicQuestState
}

export function validateQuestRendererEvent(input: unknown): QuestRendererEvent {
  return QuestRendererEventSchema.parse(input) as QuestRendererEvent
}

export function validateGameBridgeToGameEvent(
  input: unknown
): GameBridgeToGameEvent {
  return GameBridgeToGameEventSchema.parse(input) as GameBridgeToGameEvent
}

type Listener<T> = (event: T) => void

export class GameBridge {
  private gameListeners = new Set<Listener<GameBridgeToGameEvent>>()
  private questListeners = new Set<Listener<GameBridgeFromGameEvent>>()

  sendToGame(event: GameBridgeToGameEvent): void {
    const validatedEvent = validateGameBridgeToGameEvent(event)
    for (const listener of this.gameListeners) listener(validatedEvent)
  }

  sendToQuest(event: GameBridgeFromGameEvent): void {
    const validatedEvent = validateQuestRendererEvent(event)
    for (const listener of this.questListeners) listener(validatedEvent)
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
