import { expect, test, type Page } from '@playwright/test'

const questPath = '/preview/quests/emotion-detective'
const progressKey = 'quest_progress:anonymous:emotion-detective:1.0.0'

test('does not expose draft quests on the public runtime route', async ({ page }) => {
  const response = await page.goto('/quests/emotion-detective')

  expect(response?.status()).toBe(404)
})

test('runs the emotion detective quest to completion', async ({ page }) => {
  await openFreshQuest(page)

  await expect(page.getByRole('heading', { name: '情绪侦探' })).toBeVisible()
  await expect(page.locator('.phaser-container canvas')).toBeVisible()

  await completeIntro(page)
  await page.getByRole('button', { name: /生气/ }).click()
  await page.getByRole('button', { name: '确认观察' }).click()

  await page.getByRole('button', { name: /你这样说让我很难过/ }).click()
  await page.getByRole('button', { name: '继续任务' }).click()

  await page.getByRole('button', { name: '我已经准备好了' }).click()
  await page.getByRole('button', { name: '完成任务' }).click()
  await page.getByRole('button', { name: '领取徽章' }).click()

  await expect(page.getByRole('heading', { name: '你获得了情绪侦探徽章' })).toBeVisible()
  await expect.poll(() => readProgressStatus(page)).toBe('completed')
})

test('resumes saved progress and resets back to the intro', async ({ page }) => {
  await openFreshQuest(page)

  await completeIntro(page)
  await page.getByRole('button', { name: /难过/ }).click()
  await expect(page.getByRole('button', { name: /难过/ })).toHaveAttribute('aria-pressed', 'true')

  await expect.poll(() => readSelectedEmotionIds(page)).toEqual(['sad'])

  await page.reload()
  await expect(page.getByRole('heading', { name: /你觉得小宇现在可能是什么心情/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /难过/ })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: '重置进度' }).click()
  await expect(page.getByText('欢迎来到心情颜色小镇。今天，有一个小朋友的心情颜色不见了。')).toBeVisible()

  await page.reload()
  await expect(page.getByText('欢迎来到心情颜色小镇。今天，有一个小朋友的心情颜色不见了。')).toBeVisible()
})

test('loads the quest on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openFreshQuest(page)

  await expect(page.getByRole('heading', { name: '情绪侦探' })).toBeVisible()
  await expect(page.getByRole('button', { name: '继续', exact: true })).toBeVisible()
  await expect(page.locator('.phaser-container canvas')).toBeVisible()
})

async function openFreshQuest(page: Page) {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.goto(questPath)
}

async function completeIntro(page: Page) {
  await page.getByRole('button', { name: '继续', exact: true }).click()
  await page.getByRole('button', { name: '继续', exact: true }).click()
  await page.getByRole('button', { name: '完成线索' }).click()
}

async function readProgressStatus(page: Page) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw).status as string | undefined : undefined
  }, progressKey)
}

async function readSelectedEmotionIds(page: Page) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    return JSON.parse(raw).activityState?.emotion_choice_001?.selectedEmotionIds ?? []
  }, progressKey)
}
