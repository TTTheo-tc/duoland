import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { ContentExpertReview } from '@sel-quest/review-core'
import { describe, expect, it } from 'vitest'
import {
  createApprovedReview,
  runContentScript,
  validQuest,
  writeQuestFixture
} from './test-fixtures'

describe('content record review command', () => {
  it('records a matching expert review without publishing the quest', async () => {
    const review = createApprovedReview(validQuest)
    const { questsRoot } = await writeQuestFixture({ quest: validQuest })
    const reviewPath = await writeReviewFile(questsRoot, review)

    const result = await runRecordReview(questsRoot, reviewPath)
    const reviews = await readExpertReviews(questsRoot)
    const quest = JSON.parse(
      await readFile(path.join(questsRoot, 'test-quest', 'quest.json'), 'utf8')
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(`recorded expert review ${review.id}`)
    expect(reviews).toHaveLength(1)
    expect(reviews[0]).toEqual(review)
    expect(quest.status).toBe('draft')
  })

  it('rejects a stale review hash and leaves existing reviews unchanged', async () => {
    const review = {
      ...createApprovedReview(validQuest),
      contentHash: 'sha256_stale001'
    }
    const { questsRoot } = await writeQuestFixture({ quest: validQuest })
    const reviewPath = await writeReviewFile(questsRoot, review)

    const result = await runRecordReview(questsRoot, reviewPath)
    const reviews = await readExpertReviews(questsRoot)

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain(
      'expert review content hash does not match current validation report'
    )
    expect(reviews).toEqual([])
  })

  it('rejects reviews when validation report content drifts without a hash change', async () => {
    const review = createApprovedReview(validQuest)
    const { questsRoot, validationReport } = await writeQuestFixture({
      quest: validQuest
    })
    const reviewPath = await writeReviewFile(questsRoot, review)
    const reportPath = path.join(
      questsRoot,
      'test-quest',
      'validation-report.json'
    )
    const tamperedReport = {
      ...validationReport,
      validators: [
        {
          ...validationReport.validators[0],
          summary: 'Tampered summary.'
        }
      ]
    }
    await writeFile(reportPath, `${JSON.stringify(tamperedReport, null, 2)}\n`)

    const result = await runRecordReview(questsRoot, reviewPath)
    const reviews = await readExpertReviews(questsRoot)

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('validation report is out of date')
    expect(reviews).toEqual([])
  })

  it('rejects duplicate review ids', async () => {
    const review = createApprovedReview(validQuest)
    const { questsRoot } = await writeQuestFixture({
      quest: validQuest,
      expertReviews: [review]
    })
    const reviewPath = await writeReviewFile(questsRoot, review)

    const result = await runRecordReview(questsRoot, reviewPath)
    const reviews = await readExpertReviews(questsRoot)

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain(`duplicate expert review id ${review.id}`)
    expect(reviews).toHaveLength(1)
  })

  it('rejects unchanged review packet templates', async () => {
    const review = {
      ...createApprovedReview(validQuest),
      id: 'review_template_unfilled',
      reviewer: {
        id: 'reviewer_id_here',
        role: 'child_development_psychologist'
      },
      decision: 'changes_requested',
      notes: ['Replace this note with expert review notes.'],
      requiredFollowUps: ['Replace this follow-up with required changes.']
    } satisfies ContentExpertReview
    const { questsRoot } = await writeQuestFixture({ quest: validQuest })
    const reviewPath = await writeReviewFile(questsRoot, review)

    const result = await runRecordReview(questsRoot, reviewPath)
    const reviews = await readExpertReviews(questsRoot)

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('template reviewer id')
    expect(result.stderr).toContain('template placeholder text')
    expect(reviews).toEqual([])
  })
})

async function writeReviewFile(
  questsRoot: string,
  review: ContentExpertReview
) {
  const reviewPath = path.join(questsRoot, `${review.id}.json`)
  await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`)
  return reviewPath
}

async function readExpertReviews(questsRoot: string) {
  return JSON.parse(
    await readFile(
      path.join(questsRoot, 'test-quest', 'expert-reviews.json'),
      'utf8'
    )
  ) as ContentExpertReview[]
}

async function runRecordReview(questsRoot: string, reviewPath: string) {
  return runContentScript({
    scriptName: 'record-expert-review.mjs',
    args: ['test-quest', reviewPath],
    questsRoot
  })
}
