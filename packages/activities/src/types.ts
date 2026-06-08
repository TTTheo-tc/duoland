import type { ComponentType } from 'react'
import type { ZodType } from 'zod'
import type {
  ActivityDefinition,
  ActivityKind,
  ActivityResult
} from '@sel-quest/quest-core'

export interface ActivityRendererProps<TConfig = unknown, TValue = unknown> {
  activity: ActivityDefinition<TConfig>
  value: TValue | undefined
  disabled?: boolean
  onChange: (value: TValue) => void
  onComplete: (result: ActivityResult<TValue>) => void
}

export type ActivityRenderer<TConfig = unknown, TValue = unknown> =
  ComponentType<ActivityRendererProps<TConfig, TValue>>

export interface ActivityPlugin<TConfig = unknown, TValue = unknown> {
  kind: ActivityKind
  configSchema: ZodType<TConfig>
  Renderer: ActivityRenderer<TConfig, TValue>
}
