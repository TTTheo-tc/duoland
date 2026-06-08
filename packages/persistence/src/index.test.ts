import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { QuestProgressSnapshot } from '@sel-quest/quest-core'
import { LocalStorageProgressRepository } from './index'

const input = {
  userId: 'anonymous',
  questId: 'emotion-detective',
  questVersion: '1.0.0'
}

const snapshot: QuestProgressSnapshot = {
  schemaVersion: 1,
  userId: input.userId,
  questId: input.questId,
  questVersion: input.questVersion,
  status: 'in_progress',
  runtimeState: 'playing',
  currentStageId: 'choose_emotion',
  currentActivityId: 'emotion_choice_001',
  completedStageIds: ['intro'],
  completedActivityIds: ['dialogue_intro'],
  activityState: {
    emotion_choice_001: {
      selectedEmotionIds: ['sad']
    }
  },
  flags: {},
  startedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:02:00.000Z',
  lastEventId: 'event_1'
}

describe('LocalStorageProgressRepository', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: createMemoryLocalStorage()
    })
  })

  it('saves and loads a progress snapshot for resume', async () => {
    const repository = new LocalStorageProgressRepository()

    await repository.saveProgress(snapshot)

    await expect(repository.loadProgress(input)).resolves.toEqual(snapshot)
  })

  it('resets saved progress', async () => {
    const repository = new LocalStorageProgressRepository()

    await repository.saveProgress(snapshot)
    await repository.resetProgress(input)

    await expect(repository.loadProgress(input)).resolves.toBeNull()
  })

  it('ignores malformed stored progress', async () => {
    window.localStorage.setItem(
      'quest_progress:anonymous:emotion-detective:1.0.0',
      '{not json'
    )

    const repository = new LocalStorageProgressRepository()

    await expect(repository.loadProgress(input)).resolves.toBeNull()
  })

  it('ignores stored progress with the wrong shape', async () => {
    window.localStorage.setItem(
      'quest_progress:anonymous:emotion-detective:1.0.0',
      JSON.stringify({ schemaVersion: 1, questId: 'emotion-detective' })
    )

    const repository = new LocalStorageProgressRepository()

    await expect(repository.loadProgress(input)).resolves.toBeNull()
  })
})

function createMemoryLocalStorage(): Storage {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key) {
      return store.get(key) ?? null
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key) {
      store.delete(key)
    },
    setItem(key, value) {
      store.set(key, value)
    }
  }
}
