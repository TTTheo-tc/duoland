'use client'

import type { LearningEvent } from '@sel-quest/quest-core'
import type { QuestSnapshot } from './useQuestRuntime'

export function QuestDebugPanel({
  snapshot,
  events
}: {
  snapshot: QuestSnapshot
  events: LearningEvent[]
}) {
  const context = snapshot.context

  return (
    <aside className="debug-panel" aria-label="开发调试面板">
      <details>
        <summary>Debug Panel</summary>
        <dl>
          <dt>state</dt>
          <dd>{String(snapshot.value)}</dd>
          <dt>stage</dt>
          <dd>{context.currentStageId ?? '-'}</dd>
          <dt>activity</dt>
          <dd>{context.currentActivityId ?? '-'}</dd>
          <dt>completed stages</dt>
          <dd>{context.completedStageIds.join(', ') || '-'}</dd>
        </dl>
        <pre>{JSON.stringify(events.slice(-8), null, 2)}</pre>
      </details>
    </aside>
  )
}
