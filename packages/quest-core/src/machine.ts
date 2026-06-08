import { assign, createMachine } from 'xstate'
import type {
  ActivityResult,
  CreateQuestMachineInput,
  LearningEvent,
  LearningEventType,
  QuestContext,
  QuestDefinition,
  QuestEvent,
  QuestProgressSnapshot,
  QuestStageDefinition
} from './types.ts'

export function createQuestMachine(input: CreateQuestMachineInput) {
  const now = input.now ?? (() => new Date().toISOString())
  const userId = input.userId ?? 'anonymous'
  const sessionId = input.sessionId ?? createSessionId()
  const initialContext = createInitialContext(input.quest, userId, sessionId)

  return createMachine({
    id: `quest-${input.quest.id}`,
    types: {} as {
      context: QuestContext
      events: QuestEvent
    },
    initial: input.initialSnapshot ? 'playing' : 'idle',
    context: input.initialSnapshot
      ? applySnapshot(initialContext, input.initialSnapshot)
      : initialContext,
    states: {
      idle: {
        on: {
          START: {
            target: 'playing',
            actions: assign(({ context }) =>
              enterStage(
                {
                  ...context,
                  startedAt: now(),
                  updatedAt: now(),
                  events: [
                    ...context.events,
                    createLearningEvent(context, 'quest_started', now)
                  ]
                },
                context.quest.stages[0],
                now
              )
            )
          },
          RESUME: {
            target: 'playing',
            actions: assign(({ context, event }) => {
              if (event.type !== 'RESUME') return context
              const restored = applySnapshot(context, event.snapshot)
              return {
                ...restored,
                events: [
                  ...restored.events,
                  createLearningEvent(restored, 'quest_resumed', now)
                ]
              }
            })
          }
        }
      },
      playing: {
        on: {
          RESUME: {
            actions: assign(({ context, event }) =>
              event.type === 'RESUME'
                ? applySnapshot(context, event.snapshot)
                : context
            )
          },
          ENTER_STAGE: {
            actions: assign(({ context, event }) =>
              event.type === 'ENTER_STAGE'
                ? enterStage(context, findStage(context.quest, event.stageId), now)
                : context
            )
          },
          ACTIVITY_PROGRESS: {
            actions: assign(({ context, event }) => {
              if (event.type !== 'ACTIVITY_PROGRESS') return context
              return {
                ...context,
                updatedAt: now(),
                activityState: {
                  ...context.activityState,
                  [event.activityId]: event.value
                },
                events: [
                  ...context.events,
                  createLearningEvent(context, 'activity_answered', now, {
                    activityId: event.activityId
                  })
                ]
              }
            })
          },
          ACTIVITY_COMPLETED: [
            {
              guard: ({ context, event }) =>
                event.type === 'ACTIVITY_COMPLETED' &&
                canCompleteActivity(context, event.activityId, event.result),
              actions: assign(({ context, event }) => {
                if (event.type !== 'ACTIVITY_COMPLETED') return context
                return completeActivity(context, event.activityId, event.result, now)
              })
            }
          ],
          NEXT_STAGE: [
            {
              target: 'completed',
              guard: ({ context }) => isOnFinalStage(context),
              actions: assign(({ context }) => completeQuest(context, now))
            },
            {
              actions: assign(({ context }) => {
                const current = getCurrentStage(context)
                return enterStage(context, findStage(context.quest, current?.next), now)
              })
            }
          ],
          PAUSE: { target: 'paused' },
          RESET: {
            target: 'idle',
            actions: assign(({ context }) => ({
              ...createInitialContext(context.quest, context.userId, createSessionId()),
              events: [
                createLearningEvent(context, 'quest_reset', now)
              ]
            }))
          },
          ERROR: {
            target: 'error',
            actions: assign(({ context, event }) => ({
              ...context,
              lastError: event.type === 'ERROR' ? event.message : 'Unknown error'
            }))
          }
        }
      },
      paused: {
        on: {
          RESUME: {
            target: 'playing',
            actions: assign(({ context, event }) =>
              event.type === 'RESUME'
                ? applySnapshot(context, event.snapshot)
                : context
            )
          }
        }
      },
      completed: {
        on: {
          RESET: {
            target: 'idle',
            actions: assign(({ context }) =>
              createInitialContext(context.quest, context.userId, createSessionId())
            )
          }
        }
      },
      error: {
        on: {
          RESET: {
            target: 'idle',
            actions: assign(({ context }) =>
              createInitialContext(context.quest, context.userId, createSessionId())
            )
          }
        }
      }
    }
  })
}

function createInitialContext(
  quest: QuestDefinition,
  userId: string | 'anonymous',
  sessionId: string
): QuestContext {
  return {
    quest,
    userId,
    sessionId,
    completedStageIds: [],
    completedActivityIds: [],
    activityState: {},
    flags: {},
    events: []
  }
}

function applySnapshot(
  context: QuestContext,
  snapshot: QuestProgressSnapshot
): QuestContext {
  return {
    ...context,
    userId: snapshot.userId,
    currentStageId: snapshot.currentStageId,
    currentActivityId: snapshot.currentActivityId,
    completedStageIds: snapshot.completedStageIds,
    completedActivityIds: snapshot.completedActivityIds,
    activityState: snapshot.activityState,
    flags: snapshot.flags,
    startedAt: snapshot.startedAt,
    updatedAt: snapshot.updatedAt,
    completedAt: snapshot.completedAt
  }
}

function enterStage(
  context: QuestContext,
  stage: QuestStageDefinition | undefined,
  now: () => string
): QuestContext {
  if (!stage) return context
  if (!isStageUnlocked(context, stage)) return context
  const enteredAt = now()
  const event = createLearningEvent(context, 'stage_entered', () => enteredAt, {
    stageId: stage.id
  })

  const enteredContext = {
    ...context,
    currentStageId: stage.id,
    currentActivityId: stage.activityId,
    updatedAt: event.createdAt,
    events: [
      ...context.events,
      event,
      ...(stage.activityId
        ? [
            createLearningEvent(
              { ...context, currentStageId: stage.id, currentActivityId: stage.activityId },
              'activity_started',
              () => event.createdAt,
              { activityId: stage.activityId }
            )
          ]
        : [])
    ]
  }

  return applyQuestActions(enteredContext, stage.onEnter, now)
}

function completeActivity(
  context: QuestContext,
  activityId: string,
  result: ActivityResult,
  now: () => string
): QuestContext {
  const currentStage = getCurrentStage(context)
  const completedStageIds = currentStage
    ? unique([...context.completedStageIds, currentStage.id])
    : context.completedStageIds
  const completedActivityIds = unique([...context.completedActivityIds, activityId])
  const nextStage = currentStage?.next
    ? findStage(context.quest, currentStage.next)
    : undefined

  const updatedContext = applyQuestActions({
    ...context,
    completedStageIds,
    completedActivityIds,
    activityState: {
      ...context.activityState,
      [activityId]: result.value ?? context.activityState[activityId]
    },
    updatedAt: now(),
    events: [
      ...context.events,
      createLearningEvent(context, 'activity_completed', now, {
        activityId,
        learningSignal: result.learningSignal
      }),
      ...(currentStage
        ? [
            createLearningEvent(context, 'stage_completed', now, {
              stageId: currentStage.id
            })
          ]
        : [])
    ]
  }, currentStage?.onComplete, now)

  return nextStage ? enterStage(updatedContext, nextStage, now) : completeQuest(updatedContext, now)
}

function completeQuest(context: QuestContext, now: () => string): QuestContext {
  const completedAt = now()
  return {
    ...context,
    completedAt,
    updatedAt: completedAt,
    events: [
      ...context.events,
      createLearningEvent(context, 'quest_completed', now)
    ]
  }
}

function createLearningEvent(
  context: QuestContext,
  type: LearningEventType,
  now: () => string,
  payload?: Record<string, unknown>
): LearningEvent {
  return {
    id: `event_${Math.random().toString(36).slice(2, 10)}`,
    type,
    questId: context.quest.id,
    questVersion: context.quest.version,
    stageId: (payload?.stageId as string | undefined) ?? context.currentStageId,
    activityId: (payload?.activityId as string | undefined) ?? context.currentActivityId,
    userId: context.userId,
    sessionId: context.sessionId,
    payload,
    createdAt: now()
  }
}

function getCurrentStage(context: QuestContext) {
  return context.quest.stages.find((stage) => stage.id === context.currentStageId)
}

function findStage(quest: QuestDefinition, stageId?: string) {
  return quest.stages.find((stage) => stage.id === stageId)
}

function findActivity(context: QuestContext, activityId: string) {
  return context.quest.activities.find((activity) => activity.id === activityId)
}

function canCompleteActivity(
  context: QuestContext,
  activityId: string,
  result: ActivityResult
) {
  if (!result.completed) return false
  if (result.activityId !== activityId) return false
  if (context.currentActivityId !== activityId) return false

  const activity = findActivity(context, activityId)
  if (!activity) return false

  switch (activity.completion.type) {
    case 'auto':
    case 'user_submit':
      return true
    case 'learning_signal_threshold':
      return (result.learningSignal ?? 0) >= activity.completion.minLearningSignal
    case 'time_elapsed':
      return getElapsedSeconds(result) >= activity.completion.minSeconds
  }
}

function getElapsedSeconds(result: ActivityResult) {
  const elapsedSeconds = result.metadata?.elapsedSeconds
  return typeof elapsedSeconds === 'number' ? elapsedSeconds : 0
}

function isStageUnlocked(context: QuestContext, stage: QuestStageDefinition) {
  const rule = stage.unlockWhen
  if (!rule || rule.type === 'always') return true

  if (rule.type === 'stage_completed') {
    return context.completedStageIds.includes(rule.stageId)
  }

  if (rule.type === 'activity_completed') {
    return context.completedActivityIds.includes(rule.activityId)
  }

  return rule.stageIds.every((stageId) => context.completedStageIds.includes(stageId))
}

function applyQuestActions(
  context: QuestContext,
  actions: QuestStageDefinition['onEnter'] | QuestStageDefinition['onComplete'],
  now: () => string
): QuestContext {
  if (!actions?.length) return context

  return actions.reduce((nextContext, action) => {
    if (action.type === 'emit_event') {
      return {
        ...nextContext,
        events: [
          ...nextContext.events,
          createLearningEvent(nextContext, action.eventType, now, action.payload)
        ]
      }
    }

    if (action.type === 'set_flag') {
      return {
        ...nextContext,
        flags: {
          ...nextContext.flags,
          [action.key]: action.value
        }
      }
    }

    return {
      ...nextContext,
      flags: {
        ...nextContext.flags,
        [`notice:${action.noticeId}`]: true
      },
      events: [
        ...nextContext.events,
        createLearningEvent(nextContext, 'safety_notice_shown', now, {
          noticeId: action.noticeId
        })
      ]
    }
  }, context)
}

function isOnFinalStage(context: QuestContext) {
  return getCurrentStage(context)?.type === 'complete'
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values))
}

function createSessionId() {
  return `session_${Math.random().toString(36).slice(2, 10)}`
}
