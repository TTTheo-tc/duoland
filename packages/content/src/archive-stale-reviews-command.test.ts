import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  ArchivedContentExpertReview,
  ContentExpertReview
} from '@sel-quest/review-core'
import { describe, expect, it } from 'vitest'
import {
  createApprovedReview,
  runContentScript,
  validQuest,
  writeQuestFixture
} from './test-fixtures'

describe('content archive stale reviews command', () => {
  it('archives stale same-version reviews without deleting review history', async () => {
    const oldQuest = validQuest
    const revisedQuest = {
      ...validQuest,
      description: 'Revised content after expert review.'
    }
    const oldReview = createApprovedReview(oldQuest)
    const currentReview = createApprovedReview(revisedQuest)
    const { questsRoot, validationReport } = await writeQuestFixture({
      quest: revisedQuest,
      expertReviews: [oldReview, currentReview]
    })

    const result = await runArchive(questsRoot)
    const expertReviews = await readExpertReviews(questsRoot)
    const archivedReviews = await readArchivedReviews(questsRoot)

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('archived 1 stale expert review')
    expect(expertReviews).toEqual([currentReview])
    expect(archivedReviews).toHaveLength(1)
    expect(archivedReviews[0].currentContentHash).toBe(
      validationReport.contentHash
    )
    expect(archivedReviews[0].review).toEqual(oldReview)
  })

  it('supports dry runs without rewriting review files', async () => {
    const revisedQuest = {
      ...validQuest,
      description: 'Revised content after expert review.'
    }
    const oldReview = createApprovedReview(validQuest)
    const { questsRoot } = await writeQuestFixture({
      quest: revisedQuest,
      expertReviews: [oldReview]
    })

    const result = await runArchive(questsRoot, ['--dry-run'])
    const expertReviews = await readExpertReviews(questsRoot)
    const archivedReviews = await readArchivedReviewsIfExists(questsRoot)

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('would archive 1 stale expert review')
    expect(expertReviews).toEqual([oldReview])
    expect(archivedReviews).toBeNull()
  })

  it('rejects reviews that do not belong to the quest', async () => {
    const invalidReview = {
      ...createApprovedReview(validQuest),
      contentItemId: 'other-quest'
    }
    const { questsRoot } = await writeQuestFixture({
      quest: validQuest,
      expertReviews: [invalidReview]
    })

    const result = await runArchive(questsRoot)
    const expertReviews = await readExpertReviews(questsRoot)

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain(
      `expert review ${invalidReview.id} content id does not match quest id`
    )
    expect(expertReviews).toEqual([invalidReview])
  })

  it('rejects stale validation evidence before touching reviews', async () => {
    const oldReview = createApprovedReview(validQuest)
    const { questsRoot } = await writeQuestFixture({
      quest: {
        ...validQuest,
        description: 'Changed without regenerating validation.'
      },
      validationQuest: validQuest,
      expertReviews: [oldReview]
    })

    const result = await runArchive(questsRoot)
    const expertReviews = await readExpertReviews(questsRoot)

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain(
      'validation report content hash does not match expected content hash'
    )
    expect(expertReviews).toEqual([oldReview])
  })
})

async function runArchive(questsRoot: string, args: string[] = []) {
  return runContentScript({
    scriptName: 'archive-stale-expert-reviews.mjs',
    args: ['test-quest', ...args],
    questsRoot,
    env: { CONTENT_ARCHIVE_STALE_REVIEWS_NOW: '2026-06-09T00:00:00.000Z' }
  })
}

async function readExpertReviews(questsRoot: string) {
  return JSON.parse(
    await readFile(
      path.join(questsRoot, 'test-quest', 'expert-reviews.json'),
      'utf8'
    )
  ) as ContentExpertReview[]
}

async function readArchivedReviews(questsRoot: string) {
  const reviews = await readArchivedReviewsIfExists(questsRoot)
  if (!reviews) {
    throw new Error('Expected archived reviews file to exist')
  }
  return reviews
}

async function readArchivedReviewsIfExists(questsRoot: string) {
  try {
    return JSON.parse(
      await readFile(
        path.join(questsRoot, 'test-quest', 'archived-expert-reviews.json'),
        'utf8'
      )
    ) as ArchivedContentExpertReview[]
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return null
    throw error
  }
}
