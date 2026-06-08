import type { QuestContext, QuestProgressSnapshot } from './types'

export function createProgressSnapshot(
  context: QuestContext,
  runtimeState: QuestProgressSnapshot['runtimeState'] = 'playing'
): QuestProgressSnapshot {
  return {
    schemaVersion: 1,
    userId: context.userId,
    questId: context.quest.id,
    questVersion: context.quest.version,
    status: context.completedAt ? 'completed' : 'in_progress',
    runtimeState,
    currentStageId: context.currentStageId,
    currentActivityId: context.currentActivityId,
    completedStageIds: context.completedStageIds,
    completedActivityIds: context.completedActivityIds,
    activityState: context.activityState,
    flags: context.flags,
    startedAt: context.startedAt ?? context.updatedAt ?? new Date().toISOString(),
    updatedAt: context.updatedAt ?? new Date().toISOString(),
    completedAt: context.completedAt,
    lastEventId: context.events.at(-1)?.id
  }
}
