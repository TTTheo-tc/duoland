import type { BuiltinActivityKind } from '@sel-quest/quest-core'
import type { ActivityPlugin } from './types'
import type {
  BreathingActivityConfig,
  DialogueActivityConfig,
  EmotionCardActivityConfig,
  RecapActivityConfig,
  ScenarioChoiceActivityConfig,
  SingleChoiceActivityConfig
} from './schemas'
import {
  BreathingActivity,
  DialogueActivity,
  EmotionCardActivity,
  RecapActivity,
  ScenarioChoiceActivity,
  SingleChoiceActivity
} from './components'
import {
  BreathingActivityConfigSchema,
  DialogueActivityConfigSchema,
  EmotionCardActivityConfigSchema,
  RecapActivityConfigSchema,
  ScenarioChoiceActivityConfigSchema,
  SingleChoiceActivityConfigSchema
} from './schemas'

export interface ActivityValueByKind {
  dialogue: { lineIndex: number }
  'single-choice': { selectedOptionId: string }
  'emotion-card': { selectedEmotionIds: string[] }
  'scenario-choice': { selectedChoiceId: string }
  breathing: { completedCycles: number }
  recap: { acknowledged: true }
}

export interface ActivityConfigByKind {
  dialogue: DialogueActivityConfig
  'single-choice': SingleChoiceActivityConfig
  'emotion-card': EmotionCardActivityConfig
  'scenario-choice': ScenarioChoiceActivityConfig
  breathing: BreathingActivityConfig
  recap: RecapActivityConfig
}

export type BuiltinActivityRegistry = {
  [Kind in BuiltinActivityKind]: ActivityPlugin<ActivityConfigByKind[Kind], ActivityValueByKind[Kind]>
}

export type ActivityRegistry = Record<string, ActivityPlugin>

export const builtinActivityRegistry = {
  dialogue: {
    kind: 'dialogue',
    configSchema: DialogueActivityConfigSchema,
    Renderer: DialogueActivity
  },
  'single-choice': {
    kind: 'single-choice',
    configSchema: SingleChoiceActivityConfigSchema,
    Renderer: SingleChoiceActivity
  },
  'emotion-card': {
    kind: 'emotion-card',
    configSchema: EmotionCardActivityConfigSchema,
    Renderer: EmotionCardActivity
  },
  'scenario-choice': {
    kind: 'scenario-choice',
    configSchema: ScenarioChoiceActivityConfigSchema,
    Renderer: ScenarioChoiceActivity
  },
  breathing: {
    kind: 'breathing',
    configSchema: BreathingActivityConfigSchema,
    Renderer: BreathingActivity
  },
  recap: {
    kind: 'recap',
    configSchema: RecapActivityConfigSchema,
    Renderer: RecapActivity
  }
} satisfies BuiltinActivityRegistry

export function createActivityRegistry(
  plugins: ActivityPlugin[] = []
): ActivityRegistry {
  return {
    ...(builtinActivityRegistry as unknown as ActivityRegistry),
    ...Object.fromEntries(plugins.map((plugin) => [plugin.kind, plugin]))
  } as ActivityRegistry
}

export const activityRegistry = createActivityRegistry()

export * from './types'
export * from './schemas'
export * from './components'
