import { expect, test, type Page } from '@playwright/test'

const questPath = '/preview/quests/emotion-detective'
const progressKey = 'quest_progress:anonymous:emotion-detective:1.0.0'

test('does not expose draft quests on the public runtime route', async ({ page }) => {
  const response = await page.goto('/quests/emotion-detective')

  expect(response?.status()).toBe(404)
})

test('runs the emotion detective quest to completion', async ({ page }) => {
  await openFreshQuest(page)

  await expect(page.getByLabel('开发预览说明')).toContainText(
    '此内容尚未完成专家审核，不能代表发布版本。'
  )
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

  const previewNotice = page.getByLabel('开发预览说明')
  await expect(previewNotice).toBeVisible()
  await expectPreviewNoticeFitsViewport(page)
  await expect(page.getByRole('heading', { name: '情绪侦探' })).toBeVisible()
  await expect(page.getByRole('button', { name: '继续', exact: true })).toBeVisible()
  await expect(page.locator('.phaser-container canvas')).toBeVisible()
})

test('renders and interacts with the R3F world playground', async ({ page }) => {
  await page.goto('/playground/world')

  const canvas = page.locator('.r3f-world-shell canvas')
  await expect(canvas).toBeVisible()
  await expectNonBlankWebglCanvas(page)
  await expect(page.getByText('beat_observe_drawing')).toBeVisible()
  await expect(
    page.getByText('wait_for_interactable:crumpled_drawing')
  ).toBeVisible()

  await page.getByRole('button', { name: '触发小宇' }).click()
  await expect(page.getByText('INTERACTABLE_CLICKED:xiaoyu_npc')).toBeVisible()
  await expect(page.getByText('start_activity:dialogue_intro')).toBeVisible()
  await expect(page.getByText('beat_observe_drawing')).toBeVisible()

  await page.getByRole('button', { name: '触发当前线索' }).click()
  await expect(page.getByText('beat_emotion_choice')).toBeVisible()
  await expect(page.getByText('start_activity:emotion_choice_001')).toBeVisible()
})

test('loads the R3F world playground on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/playground/world')

  await expect(page.locator('.r3f-world-shell canvas')).toBeVisible()
  await expect(page.getByRole('heading', { name: '心情颜色小镇' })).toBeVisible()
  await expectNonBlankWebglCanvas(page)
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

async function expectPreviewNoticeFitsViewport(page: Page) {
  await expect
    .poll(() =>
      page.getByLabel('开发预览说明').evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return rect.left >= 0 && rect.right <= window.innerWidth
      })
    )
    .toBe(true)
}

async function expectNonBlankWebglCanvas(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const canvas = document.querySelector('.r3f-world-shell canvas')
          if (!(canvas instanceof HTMLCanvasElement)) {
            return { ok: false, reason: 'missing canvas' }
          }

          const rect = canvas.getBoundingClientRect()
          const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
          if (!gl) {
            return {
              ok: false,
              reason: 'missing webgl context',
              rect: { width: rect.width, height: rect.height }
            }
          }

          const width = gl.drawingBufferWidth
          const height = gl.drawingBufferHeight
          const pixels = new Uint8Array(width * height * 4)
          gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

          let nonBackground = 0
          const stride = Math.max(4, Math.floor(pixels.length / 20000 / 4) * 4)
          for (let index = 0; index < pixels.length; index += stride) {
            const r = pixels[index]
            const g = pixels[index + 1]
            const b = pixels[index + 2]
            if (Math.abs(r - 215) + Math.abs(g - 245) + Math.abs(b - 255) > 35) {
              nonBackground += 1
            }
          }

          const sampled = Math.ceil(pixels.length / stride)
          return {
            ok: rect.width > 200 && rect.height > 200 && nonBackground > sampled * 0.03,
            rect: { width: rect.width, height: rect.height },
            drawingBuffer: { width, height },
            nonBackground,
            sampled
          }
        }),
      { timeout: 5000 }
    )
    .toMatchObject({ ok: true })
}
