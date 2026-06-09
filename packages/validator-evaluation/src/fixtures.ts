import type { QuestDefinition } from '@sel-quest/quest-core'
import type { ValidatorGoldCaseMutation } from './types.ts'

export const baselineGoldQuest: QuestDefinition = {
  id: 'validator-gold-quest',
  slug: 'validator-gold-quest',
  version: '1.0.0',
  status: 'draft',
  title: 'Validator Gold Quest',
  description: 'Practice naming feelings and choosing safe support.',
  domain: 'mental_health_education',
  ageBand: '8-10',
  estimatedMinutes: 8,
  learningObjectives: [
    {
      id: 'lo_emotion_recognition',
      title: 'Recognize feelings',
      childFacingText: 'I can name how a character may feel.',
      selCompetencies: ['self_awareness'],
      safe: {
        sequenced: true,
        active: true,
        focused: true,
        explicit: true
      }
    },
    {
      id: 'lo_help_seeking',
      title: 'Ask a trusted adult for help',
      childFacingText: 'I can choose when to ask a trusted adult for help.',
      selCompetencies: ['relationship_skills', 'responsible_decision_making'],
      safe: {
        sequenced: true,
        active: true,
        focused: true,
        explicit: true
      }
    }
  ],
  safety: {
    dataSensitivity: 'low',
    allowsFreeTextInput: false,
    requiresGuardianConsent: false,
    crisisHandlingRequired: false
  },
  guardianSummary: {
    title: 'Children practice safe choices',
    description: 'A structured SEL quest.',
    whatChildWillPractice: ['Naming feelings', 'Choosing help-seeking'],
    whatDataIsCollected: ['Progress and structured choices']
  },
  teacherGuide: {
    objective: 'Practice emotion recognition and help-seeking.',
    discussionPrompts: ['What can the character do next?'],
    classroomTips: ['Discuss the fictional character, not classmates.'],
    riskNotes: ['Use existing school safety processes for serious concerns.']
  },
  stages: [
    {
      id: 'emotion',
      title: 'Emotion',
      type: 'activity',
      activityId: 'emotion_001',
      next: 'scenario'
    },
    {
      id: 'scenario',
      title: 'Scenario',
      type: 'activity',
      activityId: 'scenario_001',
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
      id: 'emotion_001',
      kind: 'emotion-card',
      title: 'Name a feeling',
      learningObjectiveIds: ['lo_emotion_recognition'],
      completion: { type: 'user_submit' },
      safety: { allowsFreeTextInput: false },
      config: {
        prompt: 'How might the character feel?',
        emotions: [{ id: 'sad', label: 'Sad' }],
        acceptableEmotionIds: ['sad']
      }
    },
    {
      id: 'scenario_001',
      kind: 'scenario-choice',
      title: 'Choose a response',
      learningObjectiveIds: ['lo_help_seeking'],
      completion: { type: 'user_submit' },
      safety: { allowsFreeTextInput: false },
      config: {
        scenarioText: 'What can the character do?',
        choices: [
          {
            id: 'ask_teacher',
            label: 'Ask a trusted teacher for help',
            outcomeText: 'A trusted adult can help.',
            recommended: true,
            learningSignal: 1
          },
          {
            id: 'push',
            label: 'Push the classmate',
            outcomeText: 'This may make the conflict worse.',
            learningSignal: 0
          }
        ]
      }
    }
  ],
  assets: []
}

export function buildGoldQuest(mutation: ValidatorGoldCaseMutation): QuestDefinition {
  switch (mutation) {
    case 'none':
      return cloneQuest()
    case 'scenario_without_safe_choice':
      return patchScenarioChoice({
        choices: [
          {
            id: 'push',
            label: 'Push the classmate',
            outcomeText: 'The conflict gets worse.',
            learningSignal: 0
          }
        ]
      })
    case 'diagnostic_child_feedback':
      return patchScenarioChoice({
        choices: [
          {
            id: 'diagnose',
            label: 'Tell yourself you have depression',
            outcomeText: '你有抑郁症，需要自己诊断。',
            recommended: true,
            learningSignal: 1
          }
        ]
      })
    case 'crisis_without_teacher_risk_notes': {
      const quest = cloneQuest()
      return {
        ...quest,
        safety: {
          ...quest.safety,
          crisisHandlingRequired: true
        },
        teacherGuide: {
          ...quest.teacherGuide!,
          riskNotes: []
        }
      }
    }
    case 'quest_allows_free_text': {
      const quest = cloneQuest()
      return {
        ...quest,
        safety: {
          ...quest.safety,
          allowsFreeTextInput: true
        }
      }
    }
    case 'activity_allows_free_text':
      return {
        ...patchActivity('scenario_001', (activity) => ({
          ...activity,
          safety: {
            ...activity.safety,
            allowsFreeTextInput: true
          }
        })),
        safety: {
          ...baselineGoldQuest.safety,
          allowsFreeTextInput: true
        }
      }
    case 'emotion_invalidating_feedback':
      return patchScenarioChoice({
        choices: [
          {
            id: 'invalidating',
            label: '别难过，这没什么',
            outcomeText: '别哭，这没什么好难过。',
            recommended: true,
            learningSignal: 1
          }
        ]
      })
    case 'privacy_request_text':
      return patchActivity('emotion_001', (activity) => ({
        ...activity,
        title: '请填写真实姓名'
      }))
    case 'missing_teacher_guide': {
      const quest = cloneQuest()
      return {
        ...quest,
        teacherGuide: undefined
      }
    }
    case 'unsafe_learning_objective': {
      const quest = cloneQuest()
      return {
        ...quest,
        learningObjectives: quest.learningObjectives.map((objective) =>
          objective.id === 'lo_help_seeking'
            ? {
                ...objective,
                safe: {
                  ...objective.safe,
                  focused: false
                }
              }
            : objective
        )
      }
    }
    case 'emotion_card_without_acceptable_emotions':
      return patchActivity('emotion_001', (activity) => ({
        ...activity,
        config: {
          prompt: 'How might the character feel?',
          emotions: [{ id: 'sad', label: 'Sad' }]
        }
      }))
    case 'legacy_correct_emotion_ids':
      return patchActivity('emotion_001', (activity) => ({
        ...activity,
        config: {
          prompt: 'How might the character feel?',
          emotions: [{ id: 'sad', label: 'Sad' }],
          correctEmotionIds: ['sad']
        }
      }))
  }
}

function cloneQuest(): QuestDefinition {
  return structuredClone(baselineGoldQuest)
}

function patchScenarioChoice(config: Record<string, unknown>): QuestDefinition {
  return patchActivity('scenario_001', (activity) => ({
    ...activity,
    config: {
      scenarioText: 'What can the character do?',
      ...config
    }
  }))
}

function patchActivity(
  activityId: string,
  update: (activity: QuestDefinition['activities'][number]) => QuestDefinition['activities'][number]
): QuestDefinition {
  const quest = cloneQuest()

  return {
    ...quest,
    activities: quest.activities.map((activity) =>
      activity.id === activityId ? update(activity) : activity
    )
  }
}
