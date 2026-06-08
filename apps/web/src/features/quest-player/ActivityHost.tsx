'use client'

import {
  activityRegistry,
  type ActivityRegistry,
  type ActivityRenderer
} from '@sel-quest/activities'
import type {
  ActivityDefinition,
  ActivityResult
} from '@sel-quest/quest-core'

export function ActivityHost({
  activity,
  registry = activityRegistry,
  value,
  onChange,
  onComplete
}: {
  activity: ActivityDefinition
  registry?: ActivityRegistry
  value: unknown
  onChange: (value: unknown) => void
  onComplete: (result: ActivityResult) => void
}) {
  const plugin = registry[activity.kind]
  if (!plugin) {
    return (
      <section className="activity-panel">
        <h2>活动类型未注册</h2>
        <p>当前运行时没有找到这个活动类型的渲染器。</p>
      </section>
    )
  }

  const configResult = plugin.configSchema.safeParse(activity.config)

  if (!configResult.success) {
    return (
      <section className="activity-panel">
        <h2>活动配置有误</h2>
        <p>请在调试面板中查看内容配置。</p>
      </section>
    )
  }

  const Renderer = plugin.Renderer as ActivityRenderer<typeof configResult.data, unknown>

  return (
    <Renderer
      activity={{ ...activity, config: configResult.data }}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
    />
  )
}
