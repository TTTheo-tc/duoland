'use client'

import { useEffect, useState } from 'react'
import { createActor, type SnapshotFrom } from 'xstate'
import {
  createQuestMachine,
  type QuestDefinition,
  type QuestProgressSnapshot
} from '@sel-quest/quest-core'

type QuestMachine = ReturnType<typeof createQuestMachine>
export type QuestActor = ReturnType<typeof createActor<QuestMachine>>
export type QuestSnapshot = SnapshotFrom<QuestActor>

export function useQuestRuntime(
  quest: QuestDefinition,
  loadInitialProgress: () => Promise<QuestProgressSnapshot | null>
) {
  const [actor, setActor] = useState<QuestActor | null>(null)
  const [snapshot, setSnapshot] = useState<QuestSnapshot | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let disposed = false

    async function boot() {
      const saved = await loadInitialProgress()
      if (disposed) return

      const machine = createQuestMachine({
        quest,
        userId: 'anonymous',
        initialSnapshot: saved
      })
      const nextActor = createActor(machine)
      const subscription = nextActor.subscribe((nextSnapshot) => {
        setSnapshot(nextSnapshot)
      })
      nextActor.start()
      if (!saved) nextActor.send({ type: 'START' })

      setActor(nextActor)
      setSnapshot(nextActor.getSnapshot())
      setIsReady(true)

      return () => {
        subscription.unsubscribe()
        nextActor.stop()
      }
    }

    let cleanup: (() => void) | undefined
    boot().then((nextCleanup) => {
      cleanup = nextCleanup
    })

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [loadInitialProgress, quest])

  return { actor, snapshot, isReady }
}

export function getRuntimeState(
  snapshot: QuestSnapshot
): QuestProgressSnapshot['runtimeState'] {
  return isRuntimeState(snapshot.value) ? snapshot.value : 'playing'
}

function isRuntimeState(input: unknown): input is QuestProgressSnapshot['runtimeState'] {
  return input === 'idle' ||
    input === 'playing' ||
    input === 'paused' ||
    input === 'completed' ||
    input === 'error'
}
