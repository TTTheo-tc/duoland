'use client'

import { useCallback, useMemo, useRef } from 'react'
import {
  createProgressSnapshot,
  type QuestDefinition,
  type QuestProgressSnapshot
} from '@sel-quest/quest-core'
import {
  BrowserEventSink,
  LocalStorageProgressRepository
} from '@sel-quest/persistence'
import { getRuntimeState, type QuestSnapshot } from './useQuestRuntime'

export function useQuestPersistence(quest: QuestDefinition) {
  const repositories = useMemo(
    () => ({
      progress: new LocalStorageProgressRepository(),
      events: new BrowserEventSink()
    }),
    []
  )
  const persistedEventIds = useRef(new Set<string>())

  const loadProgress = useCallback((): Promise<QuestProgressSnapshot | null> => {
    return repositories.progress.loadProgress({
      userId: 'anonymous',
      questId: quest.id,
      questVersion: quest.version
    })
  }, [quest.id, quest.version, repositories.progress])

  const persistSnapshot = useCallback((snapshot: QuestSnapshot) => {
    const context = snapshot.context
    const progress = createProgressSnapshot(context, getRuntimeState(snapshot))
    void repositories.progress.saveProgress(progress)

    for (const event of context.events) {
      if (persistedEventIds.current.has(event.id)) continue
      persistedEventIds.current.add(event.id)
      void repositories.events.append(event)
    }
  }, [repositories.events, repositories.progress])

  const resetProgress = useCallback(() => {
    persistedEventIds.current.clear()
    return repositories.progress.resetProgress({
      userId: 'anonymous',
      questId: quest.id,
      questVersion: quest.version
    })
  }, [quest.id, quest.version, repositories.progress])

  return { loadProgress, persistSnapshot, resetProgress }
}
