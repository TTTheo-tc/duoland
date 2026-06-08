import type {
  EventSink,
  LearningEvent,
  LoadProgressInput,
  ProgressRepository,
  QuestProgressSnapshot,
  ResetProgressInput
} from '@sel-quest/quest-core'

export class LocalStorageProgressRepository implements ProgressRepository {
  loadProgress(input: LoadProgressInput): Promise<QuestProgressSnapshot | null> {
    const raw = window.localStorage.getItem(progressKey(input))
    if (!raw) return Promise.resolve(null)

    try {
      const snapshot = JSON.parse(raw)
      return Promise.resolve(isQuestProgressSnapshot(snapshot) ? snapshot : null)
    } catch {
      return Promise.resolve(null)
    }
  }

  saveProgress(snapshot: QuestProgressSnapshot): Promise<void> {
    window.localStorage.setItem(progressKey(snapshot), JSON.stringify(snapshot))
    return Promise.resolve()
  }

  resetProgress(input: ResetProgressInput): Promise<void> {
    window.localStorage.removeItem(progressKey(input))
    return Promise.resolve()
  }
}

export class BrowserEventSink implements EventSink {
  append(event: LearningEvent): Promise<void> {
    const key = eventsKey(event)
    const events = readEvents(key)
    events.push(event)
    window.localStorage.setItem(key, JSON.stringify(events.slice(-100)))
    return Promise.resolve()
  }

  listRecent(input: { sessionId: string; limit: number }): Promise<LearningEvent[]> {
    const events = Object.keys(window.localStorage)
      .filter((key) => key.startsWith('quest_events:'))
      .flatMap((key) => readEvents(key))
      .filter((event) => event.sessionId === input.sessionId)
      .slice(-input.limit)

    return Promise.resolve(events)
  }
}

function progressKey(input: {
  userId: string
  questId: string
  questVersion: string
}) {
  return `quest_progress:${input.userId}:${input.questId}:${input.questVersion}`
}

function eventsKey(input: {
  userId: string
  questId: string
  questVersion: string
  sessionId: string
}) {
  return `quest_events:${input.userId}:${input.questId}:${input.questVersion}:${input.sessionId}`
}

function readEvents(key: string): LearningEvent[] {
  const raw = window.localStorage.getItem(key)
  if (!raw) return []

  try {
    return JSON.parse(raw) as LearningEvent[]
  } catch {
    return []
  }
}

function isQuestProgressSnapshot(input: unknown): input is QuestProgressSnapshot {
  if (!isRecord(input)) return false

  return input.schemaVersion === 1 &&
    typeof input.userId === 'string' &&
    typeof input.questId === 'string' &&
    typeof input.questVersion === 'string' &&
    isProgressStatus(input.status) &&
    isRuntimeState(input.runtimeState) &&
    isOptionalString(input.currentStageId) &&
    isOptionalString(input.currentActivityId) &&
    Array.isArray(input.completedStageIds) &&
    input.completedStageIds.every((value) => typeof value === 'string') &&
    Array.isArray(input.completedActivityIds) &&
    input.completedActivityIds.every((value) => typeof value === 'string') &&
    isRecord(input.activityState) &&
    isRecord(input.flags) &&
    typeof input.startedAt === 'string' &&
    typeof input.updatedAt === 'string' &&
    isOptionalString(input.completedAt) &&
    isOptionalString(input.lastEventId)
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}

function isOptionalString(input: unknown) {
  return input === undefined || typeof input === 'string'
}

function isProgressStatus(input: unknown) {
  return input === 'not_started' || input === 'in_progress' || input === 'completed'
}

function isRuntimeState(input: unknown) {
  return input === undefined ||
    input === 'idle' ||
    input === 'playing' ||
    input === 'paused' ||
    input === 'completed' ||
    input === 'error'
}
