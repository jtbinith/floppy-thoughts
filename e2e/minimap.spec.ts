import { expect, test, type Page } from '@playwright/test'
import { newBoard, type } from './helpers'

// The mini-map: the whole board small, with a box for the part on screen.

const map = (page: Page) => page.locator('.react-flow__minimap svg')
const viewport = (page: Page) => page.locator('.react-flow__viewport').getAttribute('style')

async function someIdeas(page: Page) {
  for (const t of ['clocks that grow', 'a sundial for the pocket', 'time zones for pets', 'a calendar that forgets']) await type(page, t)
}

test('the mini-map shows every box, and can be hidden and shown again (remembered)', async ({ page }) => {
  await newBoard(page)
  await someIdeas(page)
  await expect(map(page)).toBeVisible()
  await expect(page.locator('.react-flow__minimap .mini-map__box')).toHaveCount(4)

  await page.getByRole('button', { name: 'Hide the mini-map' }).click()
  await expect(map(page)).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Show the mini-map' })).toBeVisible()
  await expect(map(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Show the mini-map' }).click()
  await expect(map(page)).toBeVisible()
})

test('the View menu, the m key and /map turn it on and off', async ({ page }) => {
  await newBoard(page)
  await page.getByRole('menuitem', { name: 'View' }).click()
  await page.getByRole('menuitem', { name: 'Hide the mini-map' }).click()
  await expect(map(page)).toHaveCount(0)

  await type(page, '/map')
  await expect(map(page)).toBeVisible()
  await expect(page.getByText('showing the mini-map')).toBeVisible()

  // m works anywhere but while typing.
  await page.locator('.react-flow__pane').click({ position: { x: 10, y: 10 } })
  await page.keyboard.press('m')
  await expect(map(page)).toHaveCount(0)
  await page.getByLabel('Terminal command').fill('m')
  await expect(map(page)).toHaveCount(0)
})

test('clicking the mini-map moves the view there; dragging its box moves around', async ({ page }) => {
  await newBoard(page)
  await someIdeas(page)
  // Zoom right in, so there's somewhere to move to.
  await page.locator('.react-flow__pane').hover({ position: { x: 400, y: 300 } })
  await page.mouse.wheel(0, -1200)
  await page.waitForTimeout(400)
  const box = (await map(page).boundingBox())!

  let before = await viewport(page)
  await page.mouse.click(box.x + 15, box.y + 15)
  await expect.poll(() => viewport(page)).not.toBe(before)

  before = await viewport(page)
  const mask = (await page.locator('.react-flow__minimap-mask').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 10, { steps: 6 })
  await page.mouse.up()
  expect(mask.width).toBeGreaterThan(0)
  await expect.poll(() => viewport(page)).not.toBe(before)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true })

  test('it starts hidden, and its button stays clear of the + button', async ({ page }) => {
    await newBoard(page)
    await expect(map(page)).toHaveCount(0)
    const show = (await page.getByRole('button', { name: 'Show the mini-map' }).boundingBox())!
    const add = (await page.getByRole('button', { name: 'Add an idea', exact: true }).first().boundingBox())!
    const overlap = show.x < add.x + add.width && add.x < show.x + show.width && show.y < add.y + add.height && add.y < show.y + show.height
    expect(overlap).toBe(false)
    await page.getByRole('button', { name: 'Show the mini-map' }).tap()
    await expect(map(page)).toBeVisible()
  })
})
