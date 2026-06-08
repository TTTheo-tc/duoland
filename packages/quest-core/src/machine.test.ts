import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import {
  createQuestMachine,
  validateQuestDefinition,
  QuestValidationError,
  type QuestDefinition
} from './index'

const mockQuest: QuestDefinition = {
  id: 'mock-quest',
  slug: 'mock-quest',
  version: '1.0.0',
  status: 'draft',
  title: 'Mock Quest',
  description: 'A test quest.',
  domain: 'sel',
  ageBand: '8-10',
  estimatedMinutes: 5,
  learningObjectives: ['Practice one choice.'],
  safety: {
    dataSensitivity: 'low',
    allowsFreeTextInput: false,
    requiresGuardianConsent: false,
    crisisHandlingRequired: false
  },
  guardianSummary: {
    title: 'Summary',
    description: 'Summary',
    whatChildWillPractice: ['Choice'],
    whatDataIsCollected: ['Progress']
  },
  stages: [
    {
      id: 'intro',
      title: 'Intro',
      type: 'story',
      activityId: 'dialogue_intro',
      next: 'complete'
    },
    {
      id: 'complete',
      title: 'Complete',
      type: 'complete'
    }
  ],
  activities: [
    {
      id: 'dialogue_intro',
      kind: 'dialogue',
      completion: { type: 'auto' },
      safety: { allowsFreeTextInput: false },
      config: {
        advanceMode: 'click',
        lines: [
          {
            speakerId: 'guide',
            speakerName: 'Guide',
            text: 'Hello'
          }
        ]
      }
    }
  ],
  assets: []
}

describe('quest-core', () => {
  it('validates a well-formed quest', () => {
    expect(validateQuestDefinition(mockQuest)).toEqual(mockQuest)
  })

  it('allows custom activity kinds for externally registered plugins', () => {
    const customActivityQuest: QuestDefinition = {
      ...mockQuest,
      activities: [
        {
          id: 'dialogue_intro',
          kind: 'custom-reflection-card',
          completion: { type: 'user_submit' },
          safety: { allowsFreeTextInput: false },
          config: {
            prompt: 'Custom activity config is validated by its plugin.'
          }
        }
      ]
    }

    expect(validateQuestDefinition(customActivityQuest)).toEqual(customActivityQuest)
  })

  it('rejects a broken stage reference', () => {
    const brokenQuest = {
      ...mockQuest,
      stages: [
        {
          ...mockQuest.stages[0],
          next: 'missing'
        },
        mockQuest.stages[1]
      ]
    }

    expect(() => validateQuestDefinition(brokenQuest)).toThrow(QuestValidationError)
  })

  it('rejects a broken unlock reference', () => {
    const brokenQuest = {
      ...mockQuest,
      stages: [
        {
          ...mockQuest.stages[0],
          unlockWhen: { type: 'stage_completed', stageId: 'missing' }
        },
        mockQuest.stages[1]
      ]
    }

    expect(() => validateQuestDefinition(brokenQuest)).toThrow(QuestValidationError)
  })

  it('advances after activity completion', () => {
    const machine = createQuestMachine({ quest: mockQuest })
    const actor = createActor(machine).start()

    actor.send({ type: 'START' })
    expect(actor.getSnapshot().context.currentStageId).toBe('intro')

    actor.send({
      type: 'ACTIVITY_COMPLETED',
      activityId: 'dialogue_intro',
      result: {
        activityId: 'dialogue_intro',
        completed: true
      }
    })

    expect(actor.getSnapshot().context.currentStageId).toBe('complete')
  })

  it('keeps an activity open until its completion rule is satisfied', () => {
    const timedQuest: QuestDefinition = {
      ...mockQuest,
      stages: [
        {
          id: 'breathing',
          title: 'Breathing',
          type: 'activity',
          activityId: 'breathing_001',
          next: 'complete'
        },
        mockQuest.stages[1]
      ],
      activities: [
        {
          id: 'breathing_001',
          kind: 'breathing',
          completion: { type: 'time_elapsed', minSeconds: 8 },
          config: {
            instruction: 'Breathe slowly.',
            inhaleSeconds: 3,
            exhaleSeconds: 3,
            cycles: 1
          }
        }
      ]
    }
    const machine = createQuestMachine({ quest: timedQuest })
    const actor = createActor(machine).start()

    actor.send({ type: 'START' })
    actor.send({
      type: 'ACTIVITY_COMPLETED',
      activityId: 'breathing_001',
      result: {
        activityId: 'breathing_001',
        completed: true,
        metadata: { elapsedSeconds: 3 }
      }
    })

    expect(actor.getSnapshot().context.currentStageId).toBe('breathing')

    actor.send({
      type: 'ACTIVITY_COMPLETED',
      activityId: 'breathing_001',
      result: {
        activityId: 'breathing_001',
        completed: true,
        metadata: { elapsedSeconds: 8 }
      }
    })

    expect(actor.getSnapshot().context.currentStageId).toBe('complete')
  })

  it('applies stage actions when entering and completing a stage', () => {
    const actionQuest: QuestDefinition = {
      ...mockQuest,
      stages: [
        {
          ...mockQuest.stages[0],
          onEnter: [{ type: 'set_flag', key: 'intro_entered', value: true }],
          onComplete: [{ type: 'show_notice', noticeId: 'ask_adult' }]
        },
        mockQuest.stages[1]
      ]
    }
    const machine = createQuestMachine({ quest: actionQuest })
    const actor = createActor(machine).start()

    actor.send({ type: 'START' })
    expect(actor.getSnapshot().context.flags.intro_entered).toBe(true)

    actor.send({
      type: 'ACTIVITY_COMPLETED',
      activityId: 'dialogue_intro',
      result: {
        activityId: 'dialogue_intro',
        completed: true
      }
    })

    expect(actor.getSnapshot().context.flags['notice:ask_adult']).toBe(true)
    expect(actor.getSnapshot().context.events.map((event) => event.type)).toContain(
      'safety_notice_shown'
    )
  })
})
