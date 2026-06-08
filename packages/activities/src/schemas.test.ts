import { describe, expect, it } from 'vitest'
import {
  BreathingActivityConfigSchema,
  DialogueActivityConfigSchema,
  EmotionCardActivityConfigSchema,
  RecapActivityConfigSchema,
  ScenarioChoiceActivityConfigSchema,
  SingleChoiceActivityConfigSchema
} from './schemas'

describe('activity config schemas', () => {
  it('accepts valid activity configs', () => {
    expect(DialogueActivityConfigSchema.safeParse({
      advanceMode: 'click',
      lines: [
        {
          speakerId: 'guide',
          speakerName: 'Guide',
          text: 'Hello'
        }
      ]
    }).success).toBe(true)

    expect(SingleChoiceActivityConfigSchema.safeParse({
      prompt: 'Pick one',
      options: [{ id: 'a', label: 'A' }]
    }).success).toBe(true)

    expect(EmotionCardActivityConfigSchema.safeParse({
      prompt: 'What emotion?',
      emotions: [{ id: 'sad', label: 'Sad' }],
      acceptableEmotionIds: ['sad']
    }).success).toBe(true)

    expect(ScenarioChoiceActivityConfigSchema.safeParse({
      scenarioText: 'What next?',
      choices: [{ id: 'ask', label: 'Ask for help', outcomeText: 'A trusted adult can help.' }]
    }).success).toBe(true)

    expect(BreathingActivityConfigSchema.safeParse({
      instruction: 'Breathe slowly.',
      inhaleSeconds: 3,
      holdSeconds: 1,
      exhaleSeconds: 3,
      cycles: 2
    }).success).toBe(true)

    expect(RecapActivityConfigSchema.safeParse({
      title: 'Recap',
      summaryPoints: ['Pause first.'],
      childTakeaway: 'I can name my feeling.'
    }).success).toBe(true)
  })

  it('rejects empty required content', () => {
    expect(DialogueActivityConfigSchema.safeParse({
      advanceMode: 'click',
      lines: []
    }).success).toBe(false)

    expect(SingleChoiceActivityConfigSchema.safeParse({
      prompt: '',
      options: [{ id: 'a', label: 'A' }]
    }).success).toBe(false)

    expect(EmotionCardActivityConfigSchema.safeParse({
      prompt: 'Pick',
      emotions: []
    }).success).toBe(false)

    expect(ScenarioChoiceActivityConfigSchema.safeParse({
      scenarioText: 'Choose',
      choices: [{ id: '', label: 'Ask', outcomeText: 'Good choice.' }]
    }).success).toBe(false)

    expect(RecapActivityConfigSchema.safeParse({
      title: 'Recap',
      summaryPoints: [],
      childTakeaway: 'I can pause.'
    }).success).toBe(false)
  })

  it('rejects invalid breathing timing', () => {
    expect(BreathingActivityConfigSchema.safeParse({
      instruction: 'Breathe slowly.',
      inhaleSeconds: 0,
      holdSeconds: -1,
      exhaleSeconds: 3,
      cycles: 2
    }).success).toBe(false)
  })
})
