import type { QuestContext, QuestDefinition } from '@sel-quest/quest-core'

export function QuestProgress({
  quest,
  context
}: {
  quest: QuestDefinition
  context: QuestContext
}) {
  const currentIndex = Math.max(
    quest.stages.findIndex((stage) => stage.id === context.currentStageId),
    0
  )
  const percent = Math.round(((currentIndex + 1) / quest.stages.length) * 100)

  return (
    <div className="progress-card" aria-label="任务进度">
      <div>
        <strong>{percent}%</strong>
        <span>{context.currentStageId ?? '准备中'}</span>
      </div>
      <div className="progress-track">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

export function CompletionCard({ quest }: { quest: QuestDefinition }) {
  return (
    <section className="activity-panel completion-panel">
      <p className="activity-kicker">任务完成</p>
      <h2>你获得了情绪侦探徽章</h2>
      <p>{quest.guardianSummary.description}</p>
      <ul className="recap-list">
        {quest.learningObjectives.map((objective) => (
          <li key={objective}>{objective}</li>
        ))}
      </ul>
    </section>
  )
}
