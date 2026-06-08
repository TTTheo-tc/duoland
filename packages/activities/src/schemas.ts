import { z } from 'zod'

export const DialogueActivityConfigSchema = z.object({
  lines: z.array(
    z.object({
      speakerId: z.string().min(1),
      speakerName: z.string().min(1),
      avatarAssetId: z.string().optional(),
      text: z.string().min(1)
    })
  ).min(1),
  advanceMode: z.enum(['click', 'auto'])
})

export const SingleChoiceActivityConfigSchema = z.object({
  prompt: z.string().min(1),
  options: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      feedback: z.string().optional(),
      learningSignal: z.number().optional()
    })
  ).min(1),
  submitLabel: z.string().optional()
})

export const EmotionCardActivityConfigSchema = z.object({
  prompt: z.string().min(1),
  emotions: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      emoji: z.string().optional(),
      description: z.string().optional()
    })
  ).min(1),
  correctEmotionIds: z.array(z.string().min(1)).optional(),
  feedbackByEmotionId: z.record(z.string()).optional()
})

export const ScenarioChoiceActivityConfigSchema = z.object({
  scenarioText: z.string().min(1),
  choices: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      outcomeText: z.string().min(1),
      recommended: z.boolean().optional(),
      learningSignal: z.number().optional()
    })
  ).min(1)
})

export const BreathingActivityConfigSchema = z.object({
  instruction: z.string().min(1),
  inhaleSeconds: z.number().int().positive(),
  holdSeconds: z.number().int().nonnegative().optional(),
  exhaleSeconds: z.number().int().positive(),
  cycles: z.number().int().positive()
})

export const RecapActivityConfigSchema = z.object({
  title: z.string().min(1),
  summaryPoints: z.array(z.string().min(1)).min(1),
  childTakeaway: z.string().min(1),
  guardianTip: z.string().optional()
})

export type DialogueActivityConfig = z.infer<typeof DialogueActivityConfigSchema>
export type SingleChoiceActivityConfig = z.infer<typeof SingleChoiceActivityConfigSchema>
export type EmotionCardActivityConfig = z.infer<typeof EmotionCardActivityConfigSchema>
export type ScenarioChoiceActivityConfig = z.infer<typeof ScenarioChoiceActivityConfigSchema>
export type BreathingActivityConfig = z.infer<typeof BreathingActivityConfigSchema>
export type RecapActivityConfig = z.infer<typeof RecapActivityConfigSchema>
