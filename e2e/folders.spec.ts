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
  await page.getByRole('button', { name: 'make it' }).click()
}

async function moveTo(page: Page, what: string, folder: string) {
  await page.getByRole('button', { name: `Move ${what}` }).click()
  await page.getByRole('dialog').getByRole('button', { name: folder }).click()
}

const cards = (page: Page) => page.locator('.boards__card strong')
const folderCards = (page: Page) => page.locator('.folders__open strong')
const openFolder = (page: Page, name: string) => page.locator('.folders__open', { hasText: name }).click()

test('make folders, put boards in them, and go in and out', async ({ page }) => {
  await makeBoards(page, 'zebra', 'apple', 'kettle')
  await newFolder(page, 'Hackathons')
  await newFolder(page, 'Uni')
  await expect(folderCards(page)).toHaveText(['Hackathons', 'Uni'])

  await moveTo(page, 'zebra', 'Hackathons')
  await expect(cards(page)).toHaveText(['kettle', 'apple'])
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
  await expect(cards(page)).toHaveText(['apple'])
})

test('a folder can move into another, but never into itself or one inside it', async ({ page }) => {
  await makeBoards(page, 'zebra')
  await newFolder(page, 'Hackathons')
  await newFolder(page, 'Uni')
  await openFolder(page, 'Hackathons')
  await newFolder(page, 'OxHack')
  await page.getByRole('button', { name: 'my boards', exact: true }).click()

  await page.getByRole('button', { name: 'Move folder Hackathons' }).click()
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
  await page.getByRole('button', { name: 'Rename folder Hacks' }).click()
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
  await page.getByRole('button', { name: 'Delete folder Hackathons' }).click()
  await expect(page.getByRole('dialog')).toContainText('It has 2 boards and 1 folder in it.')
  await page.getByRole('button', { name: 'delete it, keep what’s inside' }).click()
  await expect(folderCards(page)).toHaveText(['OxHack'])
  await expect(cards(page)).toHaveText(['kettle', 'zebra'])

  // Delete it all: the board inside goes too.
  await page.getByRole('button', { name: 'Delete folder OxHack' }).click()
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
  await expect(cards(page)).toHaveText(['zebra'])
})

test('with a mouse, a board can be dragged onto a folder', async ({ page }) => {
  await makeBoards(page, 'zebra', 'apple')
  await newFolder(page, 'Hackathons')
  await page.locator('.boards__card', { hasText: 'zebra' }).dragTo(page.locator('.folders__card', { hasText: 'Hackathons' }))
  await expect(cards(page)).toHaveText(['apple'])
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
    await page.getByRole('button', { name: /^Move board/ }).tap()
    await page.getByRole('dialog').getByRole('button', { name: 'Hackathons' }).tap()
    await expect(page.locator('.folders__card', { hasText: 'Hackathons' })).toContainText('1 board')
    // Nothing spills off the side.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  })
})
