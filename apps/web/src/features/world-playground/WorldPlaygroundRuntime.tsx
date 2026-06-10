'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { QuestDefinition } from '@sel-quest/quest-core'
import {
  createInitialWorldNarrativeRuntime,
  handleWorldNarrativeRuntimeEvent,
  type WorldNarrativeRuntimeStepResult
} from '@sel-quest/game-runtime'
import type {
  NarrativeBeat,
  NarrativeDefinition,
  NarrativeRuntimeIntent
} from '@sel-quest/narrative-core'
import { R3FWorldCanvas } from '@sel-quest/renderer-r3f'
import type {
  WorldDefinition,
  WorldRendererToRuntimeEvent,
  WorldRuntimeIntent
} from '@sel-quest/world-core'

export function WorldPlaygroundRuntime({
  quest,
  world,
  narrative
}: {
  quest: QuestDefinition
  world: WorldDefinition
  narrative: NarrativeDefinition
}) {
  const demoBeat = useMemo(() => findFirstWorldInteractionBeat(narrative), [
    narrative
  ])
  const initialRuntime = useMemo(
    () =>
      createInitialWorldNarrativeRuntime({
        world,
        narrative,
        entrySceneId: quest.worldBinding?.entrySceneId,
        episodeId: quest.episodeIds?.[0],
        beatId: demoBeat?.id
      }),
    [demoBeat?.id, narrative, quest.episodeIds, quest.worldBinding, world]
  )
  const [runtime, setRuntime] =
    useState<WorldNarrativeRuntimeStepResult>(initialRuntime)
  const [lastRendererEvent, setLastRendererEvent] =
    useState<WorldRendererToRuntimeEvent | null>(null)

  const currentBeat = findBeat(
    narrative,
    runtime.state.narrativeState.currentBeatId
  )
  const activeNarrativeIntent = runtime.narrativeIntents[0]
  const activeWorldIntent = runtime.worldIntents[0]
  const activeInteractableId =
    currentBeat?.kind === 'world_interaction'
      ? currentBeat.interactableId ?? null
      : null
  const narrativeIntentForDisplay =
    activeNarrativeIntent ??
    (activeInteractableId && currentBeat
      ? {
          type: 'wait_for_interactable' as const,
          interactableId: activeInteractableId,
          beatId: currentBeat.id
        }
      : undefined)

  const handleRendererEvent = (event: WorldRendererToRuntimeEvent) => {
    setLastRendererEvent(event)
    setRuntime((currentRuntime) =>
      handleWorldNarrativeRuntimeEvent({
        world,
        narrative,
        state: currentRuntime.state,
        event
      })
    )
  }

  return (
    <main className="world-playground-shell">
      <section className="world-stage" aria-label="3D world playground">
        <R3FWorldCanvas
          world={world}
          sceneId={runtime.state.worldState.activeSceneId}
          preserveDrawingBuffer
          onRendererEvent={handleRendererEvent}
        />
      </section>
      <aside className="world-side-panel">
        <Link href="/preview/quests/emotion-detective" className="secondary-button">
          返回任务
        </Link>
        <div>
          <p className="eyebrow">{quest.ageBand} · {quest.estimatedMinutes} 分钟</p>
          <h1>{world.title}</h1>
        </div>
        <dl className="world-facts">
          <Fact label="World" value={world.id} />
          <Fact label="Scene" value={runtime.state.worldState.activeSceneId} />
          <Fact label="Episode" value={runtime.state.narrativeState.episodeId} />
          <Fact label="Beat" value={runtime.state.narrativeState.currentBeatId} />
          <Fact
            label="Last event"
            value={formatRendererEvent(lastRendererEvent)}
          />
          <Fact
            label="World intent"
            value={formatWorldIntent(activeWorldIntent)}
          />
          <Fact
            label="Narrative intent"
            value={formatNarrativeIntent(narrativeIntentForDisplay)}
          />
        </dl>
        {activeInteractableId ? (
          <div className="world-debug-actions">
            <button
              className="secondary-button"
              onClick={() =>
                handleRendererEvent({
                  type: 'INTERACTABLE_CLICKED',
                  interactableId: 'xiaoyu_npc'
                })
              }
            >
              触发小宇
            </button>
            <button
              className="secondary-button"
              onClick={() =>
                handleRendererEvent({
                  type: 'INTERACTABLE_CLICKED',
                  interactableId: activeInteractableId
                })
              }
            >
              触发当前线索
            </button>
          </div>
        ) : null}
      </aside>
    </main>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function findFirstWorldInteractionBeat(
  narrative: NarrativeDefinition
): NarrativeBeat | undefined {
  return narrative.episodes
    .flatMap((episode) => episode.beats)
    .find((beat) => beat.kind === 'world_interaction')
}

function findBeat(
  narrative: NarrativeDefinition,
  beatId: string
): NarrativeBeat | undefined {
  return narrative.episodes
    .flatMap((episode) => episode.beats)
    .find((beat) => beat.id === beatId)
}

function formatRendererEvent(event: WorldRendererToRuntimeEvent | null) {
  if (!event) return 'none'
  if (
    event.type === 'INTERACTABLE_CLICKED' ||
    event.type === 'WORLD_OBJECT_OBSERVED'
  ) {
    return `${event.type}:${event.interactableId}`
  }
  if (event.type === 'CUTSCENE_COMPLETED') {
    return `${event.type}:${event.cutsceneId}`
  }
  if (event.type === 'WORLD_ACTIVITY_COMPLETED') {
    return `${event.type}:${event.activityId}`
  }
  if (event.type === 'WORLD_DIALOGUE_COMPLETED') {
    return `${event.type}:${event.dialogueId}`
  }
  return `${event.type}:${event.sceneId}`
}

function formatWorldIntent(intent: WorldRuntimeIntent | undefined) {
  if (!intent) return 'none'
  if (intent.type === 'start_activity') return `start_activity:${intent.activityId}`
  if (intent.type === 'start_dialogue') return `start_dialogue:${intent.dialogueId}`
  if (intent.type === 'play_cutscene') return `play_cutscene:${intent.cutsceneId}`
  return `transition_scene:${intent.sceneId}`
}

function formatNarrativeIntent(intent: NarrativeRuntimeIntent | undefined) {
  if (!intent) return 'none'
  if (intent.type === 'start_activity') return `start_activity:${intent.activityId}`
  if (intent.type === 'start_dialogue') return `start_dialogue:${intent.dialogueId}`
  if (intent.type === 'play_cutscene') return `play_cutscene:${intent.cutsceneId}`
  if (intent.type === 'wait_for_interactable') {
    return `wait_for_interactable:${intent.interactableId}`
  }
  if (intent.type === 'transition_scene') return `transition_scene:${intent.sceneId}`
  if (intent.type === 'set_world_flag') return `set_world_flag:${intent.flag}`
  return `show_notice:${intent.noticeId}`
}
