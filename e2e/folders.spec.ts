import { expect, test, type Page } from '@playwright/test'
import { type } from './helpers'

// Folders on the boards page, for boards kept in this browser. (Account folders use the same
// steps, saved to the database: see supabase/tests/folders.test.sql.)

async function makeBoards(page: Page, ...names: string[]) {
  for (const name of names) {
    await page.goto('#/new')
    await page.getByRole('button', { name: 'skip' }).click()
    await type(page, `/rename ${name}`)
  }
  await page.goto('#/boards')
}

async function newFolder(page: Page, name: string) {
  await page.getByRole('button', { name: 'new folder' }).click()
  await page.getByLabel('Folder name').fill(name)
  await page.getByRole('button', { name: 'Make folder' }).click()
}

async function moveTo(page: Page, what: string, folder: string) {
  await page.getByRole('button', { name: `Board options for ${what}` }).click()
  await page.getByRole('menuitem', { name: 'move' }).click()
  await page.getByRole('dialog').getByRole('button', { name: folder }).click()
}

const cards = (page: Page) => page.locator('.boards__card strong')
const folderCards = (page: Page) => page.locator('.folders__open strong')
// A finger: touch down on one thing, hold, slide to another and let go. If the other thing is off
// screen, the finger waits at the edge while the page scrolls to it.
async function holdAndDrag(page: Page, from: ReturnType<Page['locator']>, to: ReturnType<Page['locator']>) {
  await from.scrollIntoViewIfNeeded()
  const a = await from.boundingBox()
  if (!a) throw new Error('not on screen')
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: string, x?: number, y?: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x === undefined ? [] : [{ x, y: y! }] })
  let [x, y] = [a.x + 30, a.y + 30]
  await touch('touchStart', x, y)
  await page.waitForTimeout(500)
  const height = page.viewportSize()!.height
  for (let i = 0; i < 60; i++) {
    const b = await to.boundingBox()
    const [tx, ty] = [b!.x + 20, b!.y + 15]
    const goal = ty < 10 ? 5 : ty > height - 10 ? height - 5 : ty
    x += (tx - x) / 4
    y += (goal - y) / 4
    await touch('touchMove', x, y)
    if (Math.abs(ty - y) < 3 && Math.abs(tx - x) < 3) break
    await page.waitForTimeout(30)
  }
  await touch('touchEnd')
}
// A folder's ⋯ menu, then one of rename, move or delete.
async function folderAction(page: Page, folder: string, action: 'rename' | 'move' | 'delete') {
  await page.getByRole('button', { name: `Folder options for ${folder}` }).click()
  await page.getByRole('menuitem', { name: action }).click()
}
const openFolder = (page: Page, name: string) => page.locator('.folders__open', { hasText: name }).click()

test('make folders, put boards in them, and go in and out', async ({ page }) => {
  await makeBoards(page, 'zebra', 'apple', 'kettle')
  await newFolder(page, 'Hackathons')
  await newFolder(page, 'Uni')
  await expect(folderCards(page)).toHaveText(['Hackathons', 'Uni'])

  await moveTo(page, 'zebra', 'Hackathons')
  // The top still lists every board, saying where each one is.
  await expect(cards(page)).toHaveText(['kettle', 'apple', 'zebra'])
  await expect(page.locator('.boards__card', { hasText: 'zebra' })).toContainText('in Hackathons')
  await expect(page.locator('.folders__card', { hasText: 'Hackathons' })).toContainText('1 board')

  await openFolder(page, 'Hackathons')
  await expect(cards(page)).toHaveText(['zebra'])
  // A folder inside it, and a board moved into that.
  await newFolder(page, 'OxHack')
  await moveTo(page, 'zebra', 'OxHack')
  await openFolder(page, 'OxHack')
  await expect(page.getByRole('navigation', { name: 'Folder' })).toHaveText(/my boards\s*\/\s*Hackathons\s*\/\s*OxHack/)
  await expect(cards(page)).toHaveText(['zebra'])

  // Back up the path, and still there after a reload.
  await page.getByRole('button', { name: 'Hackathons', exact: true }).click()
  await expect(folderCards(page)).toHaveText(['OxHack'])
  await page.reload()
  await expect(folderCards(page)).toHaveText(['OxHack'])
  await page.getByRole('button', { name: 'my boards', exact: true }).click()
  await expect(page.locator('.folders__card', { hasText: 'Hackathons' })).toContainText('1 board · 1 folder')

  // And out of a folder again.
  await openFolder(page, 'Hackathons')
  await openFolder(page, 'OxHack')
  await moveTo(page, 'zebra', 'my boards')
  await expect(cards(page)).toHaveCount(0)
  await expect(page.getByText("This folder's empty.")).toBeVisible()
})

test('search finds boards in every folder, and says where they are', async ({ page }) => {
  await makeBoards(page, 'zebra', 'apple')
  await newFolder(page, 'Hackathons')
  await moveTo(page, 'zebra', 'Hackathons')
  await page.getByLabel('Search boards').fill('zeb')
  await expect(cards(page)).toHaveText(['zebra'])
  await expect(page.locator('.boards__card')).toContainText('in Hackathons')
  await page.getByLabel('Search boards').fill('')
  await expect(cards(page)).toHaveText(['apple', 'zebra'])
})

test('a folder can move into another, but never into itself or one inside it', async ({ page }) => {
  await makeBoards(page, 'zebra')
  await newFolder(page, 'Hackathons')
  await newFolder(page, 'Uni')
  await openFolder(page, 'Hackathons')
  await newFolder(page, 'OxHack')
  await page.getByRole('button', { name: 'my boards', exact: true }).click()

  await folderAction(page, 'Hackathons', 'move')
  const targets = page.getByRole('dialog').getByRole('listitem')
  await expect(targets).toHaveText([/my boards/, /Uni/])
  await page.getByRole('dialog').getByRole('button', { name: 'Uni' }).click()
  await expect(folderCards(page)).toHaveText(['Uni'])
  await openFolder(page, 'Uni')
  await expect(folderCards(page)).toHaveText(['Hackathons'])
})

test('rename a folder', async ({ page }) => {
  await makeBoards(page, 'zebra')
  await newFolder(page, 'Hacks')
  await folderAction(page, 'Hacks', 'rename')
  await page.getByLabel('Folder name').fill('Hackathons')
  await page.getByLabel('Folder name').press('Enter')
  await expect(folderCards(page)).toHaveText(['Hackathons'])
})

test('deleting a folder asks: keep what is inside, or delete it all', async ({ page }) => {
  await makeBoards(page, 'zebra', 'apple', 'kettle')
  await newFolder(page, 'Hackathons')
  await moveTo(page, 'zebra', 'Hackathons')
  await openFolder(page, 'Hackathons')
  await newFolder(page, 'OxHack')
  await page.getByRole('button', { name: 'my boards', exact: true }).click()
  await moveTo(page, 'apple', 'OxHack')

  // Keep: its board and folder move up to the top.
  await folderAction(page, 'Hackathons', 'delete')
  await expect(page.getByRole('dialog')).toContainText('It has 2 boards and 1 folder in it.')
  await page.getByRole('button', { name: 'delete it, keep what’s inside' }).click()
  await expect(folderCards(page)).toHaveText(['OxHack'])
  await expect(cards(page)).toHaveText(['kettle', 'apple', 'zebra'])
  await expect(page.locator('.boards__card', { hasText: 'zebra' })).not.toContainText('in ')

  // Delete it all: the board inside goes too.
  await folderAction(page, 'OxHack', 'delete')
  await page.getByRole('button', { name: 'delete it and its board' }).click()
  await expect(folderCards(page)).toHaveCount(0)
  await expect(cards(page)).toHaveText(['kettle', 'zebra'])
  await page.getByLabel('Search boards').fill('apple')
  await expect(page.getByText('No boards match')).toBeVisible()
})

test('a new board started inside a folder goes in that folder', async ({ page }) => {
  await makeBoards(page, 'zebra')
  await newFolder(page, 'Hackathons')
  await openFolder(page, 'Hackathons')
  await page.getByRole('link', { name: 'new board' }).click()
  await page.getByRole('button', { name: 'skip' }).click()
  await type(page, '/rename fresh')
  await page.goto('#/boards')
  await expect(cards(page)).toHaveText(['fresh'])
  await page.getByRole('button', { name: 'my boards', exact: true }).click()
  await expect(cards(page)).toHaveText(['fresh', 'zebra'])
})

test('with a mouse, a board can be dragged onto a folder', async ({ page }) => {
  await makeBoards(page, 'zebra', 'apple')
  await newFolder(page, 'Hackathons')
  await page.locator('.boards__card', { hasText: 'zebra' }).dragTo(page.locator('.folders__card', { hasText: 'Hackathons' }))
  await expect(page.locator('.boards__card', { hasText: 'zebra' })).toContainText('in Hackathons')
  await openFolder(page, 'Hackathons')
  await expect(cards(page)).toHaveText(['zebra'])
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true })

  test('boards move into folders by tapping', async ({ page }) => {
    await page.goto('#/new')
    await page.getByRole('button', { name: 'skip' }).click()
    await page.goto('#/boards')
    await newFolder(page, 'Hackathons')
    await page.getByRole('button', { name: /^Board options for board/ }).tap()
    await page.getByRole('menuitem', { name: 'move' }).tap()
    await page.getByRole('dialog').getByRole('button', { name: 'Hackathons' }).tap()
    await expect(page.locator('.folders__card', { hasText: 'Hackathons' })).toContainText('1 board')
    // Press and hold a board, drag it onto a folder, let go.
    await page.getByRole('button', { name: 'new folder' }).tap()
    await page.getByLabel('Folder name').fill('Uni')
    await page.getByRole('button', { name: 'Make folder' }).tap()
    await openFolder(page, 'Hackathons')
    await holdAndDrag(page, page.locator('.boards__card').first(), page.getByRole('button', { name: 'my boards', exact: true }))
    await expect(page.locator('.boards__card')).toHaveCount(0)
    await page.getByRole('button', { name: 'my boards', exact: true }).tap()
    await holdAndDrag(page, page.locator('.boards__card').first(), page.locator('.folders__card', { hasText: 'Uni' }))
    await expect(page.locator('.folders__card', { hasText: 'Uni' })).toContainText('1 board')
    // A quick tap still opens a folder, not a drag.
    await openFolder(page, 'Uni')
    await expect(page.getByRole('navigation', { name: 'Folder' })).toContainText('Uni')
    // Nothing spills off the side.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  })
})
