import { expect, test } from '@playwright/test'

test('loads the authoring dashboard', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: '内容生产与审核' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '情绪侦探' })).toBeVisible()
  await expect(page.getByText('needs expert review')).toBeVisible()
  await expect(page.getByText('world_narrative')).toBeVisible()
  await expect(page.getByText('asset_representation')).toBeVisible()
  await expect(page.getByRole('link', { name: '预览' })).toHaveAttribute(
    'href',
    'http://127.0.0.1:3000/preview/quests/emotion-detective'
  )
})

test('loads the authoring dashboard on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: '内容生产与审核' })).toBeVisible()
  await expect(page.getByRole('link', { name: '打开儿童端' })).toBeVisible()
  await expect(page.getByText('needs expert review')).toBeVisible()
})
