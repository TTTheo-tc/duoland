'use client'

import { useEffect, useMemo } from 'react'
import type { ActivityRegistry } from '@sel-quest/activities'
import type { RendererPublicQuestState } from '@sel-quest/game-runtime'
import type { QuestDefinition } from '@sel-quest/quest-core'
import { PhaserCanvas } from '@sel-quest/renderer-phaser'
import { childSafetyBoundaryText } from '@sel-quest/safety'
import { ActivityHost } from './ActivityHost'
import { QuestDebugPanel } from './QuestDebugPanel'
import { CompletionCard, QuestProgress } from './QuestProgress'
import { useQuestPersistence } from './useQuestPersistence'
import { useQuestRuntime } from './useQuestRuntime'

export function QuestPlayer({
  quest,
  activityRegistry
}: {
  quest: QuestDefinition
  activityRegistry?: ActivityRegistry
}) {
  const { loadProgress, persistSnapshot, resetProgress } = useQuestPersistence(quest)
  const { actor, snapshot, isReady } = useQuestRuntime(quest, loadProgress)
  const context = snapshot?.context
  const currentStageId = context?.currentStageId
  const currentActivityId = context?.currentActivityId
  const completedStageIds = context?.completedStageIds
  const completedActivityIds = context?.completedActivityIds
  const flags = context?.flags
  const questState = useMemo<RendererPublicQuestState | null>(
    () => {
      if (!completedStageIds || !completedActivityIds || !flags) return null

      return {
        currentStageId,
        currentActivityId,
        completedStageIds,
        completedActivityIds,
        flags
      }
    },
    [
      completedActivityIds,
      completedStageIds,
      currentActivityId,
      currentStageId,
      flags
    ]
  )

  useEffect(() => {
    if (!snapshot) return
    persistSnapshot(snapshot)
  }, [persistSnapshot, snapshot])

  if (!isReady || !actor || !snapshot || !context || !questState) {
    return (
      <main className="quest-shell">
        <div className="loading-card">任务加载中...</div>
      </main>
    )
  }

  const currentStage = quest.stages.find((stage) => stage.id === context.currentStageId)
  const currentActivity = quest.activities.find(
    (activity) => activity.id === context.currentActivityId
  )
  const isCompleted = Boolean(context.completedAt)

  return (
    <main className="quest-shell">
      <header className="quest-topbar">
        <div>
          <p className="eyebrow">{quest.ageBand} · {quest.estimatedMinutes} 分钟</p>
          <h1>{quest.title}</h1>
        </div>
        <button
          className="secondary-button"
          onClick={async () => {
            await resetProgress()
            actor.send({ type: 'RESET' })
            actor.send({ type: 'START' })
          }}
        >
          重置进度
        </button>
      </header>

      <section className="safety-note" aria-label="产品边界说明">
        {childSafetyBoundaryText}
      </section>

      <div className="quest-layout">
        <PhaserCanvas
          quest={quest}
          questState={questState}
        />
        <section className="quest-workspace">
          <QuestProgress quest={quest} context={context} />
          {isCompleted ? (
            <CompletionCard quest={quest} />
          ) : currentActivity ? (
            <ActivityHost
              activity={currentActivity}
              registry={activityRegistry}
              value={context.activityState[currentActivity.id]}
              onChange={(value) => {
                actor.send({
                  type: 'ACTIVITY_PROGRESS',
                  activityId: currentActivity.id,
                  value
                })
              }}
              onComplete={(result) => {
                actor.send({
                  type: 'ACTIVITY_COMPLETED',
                  activityId: currentActivity.id,
                  result
                })
              }}
            />
          ) : currentStage?.type === 'complete' ? (
            <section className="activity-panel">
              <p className="activity-kicker">最后一步</p>
              <h2>{currentStage.title}</h2>
              <p>你已经完成了所有练习。点击按钮领取本次任务徽章。</p>
              <button
                className="primary-button"
                onClick={() => actor.send({ type: 'NEXT_STAGE' })}
              >
                领取徽章
              </button>
            </section>
          ) : (
            <div className="loading-card">正在准备下一步...</div>
          )}
        </section>
      </div>

      {process.env.NODE_ENV === 'development' ? (
        <QuestDebugPanel snapshot={snapshot} events={context.events} />
      ) : null}
    </main>
  )
}
