import { z } from 'zod'
import type { QuestDefinition } from './types'
import {
  QuestValidationError,
  validateQuestSemantics
} from './validators'

export const QuestStatusSchema = z.enum(['draft', 'published', 'archived'])
export const AgeBandSchema = z.enum(['6-8', '8-10', '10-12', '12-15'])

export const DataSensitivitySchema = z.enum([
  'none',
  'low',
  'child_personal',
  'psychological_sensitive'
])

export const QuestSafetySchema = z.object({
  dataSensitivity: DataSensitivitySchema,
  allowsFreeTextInput: z.boolean(),
  requiresGuardianConsent: z.boolean(),
  crisisHandlingRequired: z.boolean(),
  minAge: z.number().int().optional(),
  maxAge: z.number().int().optional()
})

export const UnlockRuleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('always') }),
  z.object({
    type: z.literal('stage_completed'),
    stageId: z.string().min(1)
  }),
  z.object({
    type: z.literal('activity_completed'),
    activityId: z.string().min(1)
  }),
  z.object({
    type: z.literal('all_stages_completed'),
    stageIds: z.array(z.string().min(1)).min(1)
  })
])

export const LearningEventTypeSchema = z.enum([
  'quest_started',
  'quest_resumed',
  'quest_resume_failed',
  'stage_entered',
  'activity_started',
  'activity_answered',
  'activity_completed',
  'stage_completed',
  'quest_completed',
  'quest_reset',
  'safety_notice_shown'
])

export const QuestActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('emit_event'),
    eventType: LearningEventTypeSchema,
    payload: z.record(z.unknown()).optional()
  }),
  z.object({
    type: z.literal('set_flag'),
    key: z.string().min(1),
    value: z.union([z.boolean(), z.string(), z.number()])
  }),
  z.object({
    type: z.literal('show_notice'),
    noticeId: z.string().min(1)
  })
])

export const QuestStageSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(['intro', 'story', 'activity', 'reflection', 'recap', 'complete']),
  activityId: z.string().optional(),
  unlockWhen: UnlockRuleSchema.optional(),
  onEnter: z.array(QuestActionSchema).optional(),
  onComplete: z.array(QuestActionSchema).optional(),
  next: z.string().optional()
})

export const ActivityCompletionRuleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('auto') }),
  z.object({ type: z.literal('user_submit') }),
  z.object({
    type: z.literal('learning_signal_threshold'),
    minLearningSignal: z.number()
  }),
  z.object({
    type: z.literal('time_elapsed'),
    minSeconds: z.number().int().positive()
  })
])

export const ActivityDefinitionSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  title: z.string().optional(),
  config: z.unknown(),
  completion: ActivityCompletionRuleSchema,
  safety: z
    .object({
      allowsFreeTextInput: z.boolean().optional(),
      maxInputLength: z.number().int().positive().optional(),
      blockedTopics: z.array(z.string()).optional(),
      dataSensitivity: DataSensitivitySchema.optional()
    })
    .optional()
})

export const QuestAssetSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['image', 'audio', 'spritesheet', 'json', 'video']),
  src: z.string().min(1),
  alt: z.string().optional(),
  preload: z.boolean().optional()
})

export const QuestDefinitionSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  version: z.string().min(1),
  status: QuestStatusSchema,
  title: z.string().min(1),
  subtitle: z.string().optional(),
  description: z.string().min(1),
  domain: z.enum([
    'sel',
    'mental_health_education',
    'family_school_collaboration',
    'ai_literacy',
    'general'
  ]),
  ageBand: AgeBandSchema,
  estimatedMinutes: z.number().int().positive(),
  learningObjectives: z.array(z.string().min(1)).min(1),
  safety: QuestSafetySchema,
  guardianSummary: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    whatChildWillPractice: z.array(z.string()),
    whatDataIsCollected: z.array(z.string()),
    familyExtensionTips: z.array(z.string()).optional()
  }),
  teacherGuide: z
    .object({
      objective: z.string().min(1),
      suggestedDurationMinutes: z.number().int().positive().optional(),
      discussionPrompts: z.array(z.string()),
      classroomTips: z.array(z.string()),
      riskNotes: z.array(z.string()).optional()
    })
    .optional(),
  stages: z.array(QuestStageSchema).min(1),
  activities: z.array(ActivityDefinitionSchema).min(1),
  assets: z.array(QuestAssetSchema).default([])
})

export function validateQuestDefinition(input: unknown): QuestDefinition {
  const quest = QuestDefinitionSchema.parse(input) as QuestDefinition
  const issues = validateQuestSemantics(quest)
  const errors = issues.filter((issue) => issue.severity === 'error')

  if (errors.length > 0) {
    throw new QuestValidationError(errors)
  }

  return quest
}
