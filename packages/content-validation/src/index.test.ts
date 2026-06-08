import { describe, expect, it } from 'vitest'
import type { QuestDefinition } from '@sel-quest/quest-core'
import { validateSelQuestContent } from './index'

const validQuest: QuestDefinition = {
  id: 'emotion-detective',
  slug: 'emotion-detective',
  version: '1.0.0',
  status: 'draft',
  title: 'Emotion Detective',
  description: 'Practice naming feelings and choosing supportive actions.',
  domain: 'mental_health_education',
  ageBand: '8-10',
  estimatedMinutes: 10,
  learningObjectives: ['Recognize feelings', 'Ask a trusted adult for help'],
  safety: {
    dataSensitivity: 'low',
    allowsFreeTextInput: false,
    requiresGuardianConsent: false,
    crisisHandlingRequired: false
  },
  guardianSummary: {
    title: 'Children practice feelings',
    description: 'A structured SEL quest.',
    whatChildWillPractice: ['Naming feelings'],
    whatDataIsCollected: ['Progress and structured choices']
  },
  teacherGuide: {
    objective: 'Practice emotion recognition.',
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
          }
        ]
      }
    }
  ],
  assets: []
}

describe('content-validation', () => {
  it('passes a structured SEL quest with safe choices', () => {
    const report = validateSelQuestContent(validQuest, {
      now: () => '2026-06-09T00:00:00.000Z'
    })

    expect(report.status).toBe('passed')
    expect(report.summary.safetyDecision).toBe('allow')
    expect(report.issues).toEqual([])
  })

  it('blocks SEL quests that enable child free text', () => {
    const report = validateSelQuestContent({
      ...validQuest,
      safety: {
        ...validQuest.safety,
        allowsFreeTextInput: true
      }
    })

    expect(report.status).toBe('needs_major_revision')
    expect(report.issues.map((issue) => issue.type)).toContain(
      'privacy_sensitive_prompt'
    )
    expect(report.issues.some((issue) => issue.blocksPublishing)).toBe(true)
  })

  it('blocks scenario choices without a safe response option', () => {
    const report = validateSelQuestContent({
      ...validQuest,
      activities: validQuest.activities.map((activity) =>
        activity.id === 'scenario_001'
          ? {
              ...activity,
              config: {
                scenarioText: 'What can the character do?',
                choices: [
                  {
                    id: 'push',
                    label: 'Push the classmate',
                    outcomeText: 'The conflict gets worse.',
                    learningSignal: 0
                  }
                ]
              }
            }
          : activity
      )
    })

    expect(report.status).toBe('blocked')
    expect(report.issues.map((issue) => issue.type)).toContain(
      'no_safe_response_option'
    )
  })

  it('blocks diagnostic or therapy-like child-facing feedback', () => {
    const report = validateSelQuestContent({
      ...validQuest,
      activities: validQuest.activities.map((activity) =>
        activity.id === 'scenario_001'
          ? {
              ...activity,
              config: {
                scenarioText: 'What can the character do?',
                choices: [
                  {
                    id: 'diagnose',
                    label: 'Tell yourself you have depression',
                    outcomeText: '你有抑郁症，需要自己诊断。',
                    recommended: true,
                    learningSignal: 1
                  }
                ]
              }
            }
          : activity
      )
    })

    expect(report.status).toBe('blocked')
    expect(report.issues.map((issue) => issue.type)).toContain(
      'overly_diagnostic'
    )
  })

  it('scans child-visible subtitles and stage or activity titles', () => {
    const report = validateSelQuestContent({
      ...validQuest,
      subtitle: '你有抑郁症',
      stages: validQuest.stages.map((stage) =>
        stage.id === 'emotion'
          ? { ...stage, title: '不要难过，这没什么' }
          : stage
      ),
      activities: validQuest.activities.map((activity) =>
        activity.id === 'emotion_001'
          ? { ...activity, title: '请填写真实姓名' }
          : activity
      )
    })

    expect(report.status).toBe('blocked')
    expect(report.issues.map((issue) => issue.type)).toEqual(
      expect.arrayContaining([
        'overly_diagnostic',
        'emotion_invalidating',
        'privacy_sensitive_prompt'
      ])
    )
  })
})
