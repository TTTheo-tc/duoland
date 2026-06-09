import type { QuestDefinition } from './types.ts'

export interface QuestValidationIssue {
  path: string
  code: string
  message: string
  severity: 'error' | 'warning'
}

export class QuestValidationError extends Error {
  issues: QuestValidationIssue[]

  constructor(issues: QuestValidationIssue[]) {
    super('Quest semantic validation failed')
    this.issues = issues
  }
}

const dataSensitivityRank = {
  none: 0,
  low: 1,
  child_personal: 2,
  psychological_sensitive: 3
} as const

export function validateQuestSemantics(
  quest: QuestDefinition
): QuestValidationIssue[] {
  const issues: QuestValidationIssue[] = []
  const stageIds = new Set<string>()
  const activityIds = new Set<string>()
  const objectiveIds = new Set<string>()

  for (const objective of quest.learningObjectives) {
    if (objectiveIds.has(objective.id)) {
      issues.push(
        error(
          `learningObjectives.${objective.id}`,
          'duplicate_learning_objective_id',
          'Duplicate learning objective id.'
        )
      )
    }
    objectiveIds.add(objective.id)
  }

  for (const stage of quest.stages) {
    if (stageIds.has(stage.id)) {
      issues.push(error(`stages.${stage.id}`, 'duplicate_stage_id', 'Duplicate stage id.'))
    }
    stageIds.add(stage.id)
  }

  for (const activity of quest.activities) {
    if (activityIds.has(activity.id)) {
      issues.push(
        error(`activities.${activity.id}`, 'duplicate_activity_id', 'Duplicate activity id.')
      )
    }
    activityIds.add(activity.id)

    for (const objectiveId of activity.learningObjectiveIds) {
      if (!objectiveIds.has(objectiveId)) {
        issues.push(
          error(
            `activities.${activity.id}.learningObjectiveIds`,
            'unknown_learning_objective_id',
            'Activity references an unknown learning objective.'
          )
        )
      }
    }
  }

  for (const stage of quest.stages) {
    if (stage.type === 'activity' || stage.type === 'story' || stage.type === 'recap') {
      if (!stage.activityId) {
        issues.push(error(`stages.${stage.id}.activityId`, 'missing_activity_id', 'Stage requires an activityId.'))
      } else if (!activityIds.has(stage.activityId)) {
        issues.push(error(`stages.${stage.id}.activityId`, 'unknown_activity_id', 'Stage references an unknown activity.'))
      }
    }

    if (stage.type === 'complete' && stage.next) {
      issues.push(error(`stages.${stage.id}.next`, 'complete_has_next', 'Complete stage must not define next.'))
    }

    if (stage.next && !stageIds.has(stage.next)) {
      issues.push(error(`stages.${stage.id}.next`, 'unknown_next_stage', 'Stage references an unknown next stage.'))
    }

    if (stage.unlockWhen?.type === 'stage_completed' && !stageIds.has(stage.unlockWhen.stageId)) {
      issues.push(error(`stages.${stage.id}.unlockWhen.stageId`, 'unknown_unlock_stage', 'Unlock rule references an unknown stage.'))
    }

    if (stage.unlockWhen?.type === 'activity_completed' && !activityIds.has(stage.unlockWhen.activityId)) {
      issues.push(error(`stages.${stage.id}.unlockWhen.activityId`, 'unknown_unlock_activity', 'Unlock rule references an unknown activity.'))
    }

    if (stage.unlockWhen?.type === 'all_stages_completed') {
      for (const unlockStageId of stage.unlockWhen.stageIds) {
        if (!stageIds.has(unlockStageId)) {
          issues.push(error(`stages.${stage.id}.unlockWhen.stageIds`, 'unknown_unlock_stage', 'Unlock rule references an unknown stage.'))
        }
      }
    }

    if (stage.type !== 'complete' && !stage.next) {
      issues.push(error(`stages.${stage.id}.next`, 'missing_next_stage', 'Non-complete stage must define next.'))
    }
  }

  const firstStage = quest.stages[0]
  if (firstStage) {
    const reachable = collectReachableStageIds(quest, firstStage.id)
    for (const stage of quest.stages) {
      if (!reachable.has(stage.id)) {
        issues.push(
          error(`stages.${stage.id}`, 'unreachable_stage', 'Stage is not reachable from the first stage.')
        )
      }
    }
  }

  for (const activity of quest.activities) {
    if (
      activity.safety?.allowsFreeTextInput &&
      !quest.safety.allowsFreeTextInput
    ) {
      issues.push(
        error(
          `activities.${activity.id}.safety.allowsFreeTextInput`,
          'activity_exceeds_quest_safety',
          'Activity free-text input cannot exceed quest safety policy.'
        )
      )
    }

    const activitySensitivity = activity.safety?.dataSensitivity
    if (
      activitySensitivity &&
      dataSensitivityRank[activitySensitivity] >
        dataSensitivityRank[quest.safety.dataSensitivity]
    ) {
      issues.push(
        error(
          `activities.${activity.id}.safety.dataSensitivity`,
          'activity_exceeds_quest_data_sensitivity',
          'Activity data sensitivity cannot exceed quest sensitivity.'
        )
      )
    }
  }

  return issues
}

function collectReachableStageIds(quest: QuestDefinition, startId: string) {
  const stagesById = new Map(quest.stages.map((stage) => [stage.id, stage]))
  const reachable = new Set<string>()
  let cursor: string | undefined = startId

  while (cursor && !reachable.has(cursor)) {
    reachable.add(cursor)
    cursor = stagesById.get(cursor)?.next
  }

  return reachable
}

function error(
  path: string,
  code: string,
  message: string
): QuestValidationIssue {
  return { path, code, message, severity: 'error' }
}
