import { expect, test, type Page } from '@playwright/test'
import { box, boxes, links, newBoard } from './helpers'

// The touch-first layout on a phone: a small screen with touch and no mouse.
test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true })

// Adds an idea with the round + button and puts it down with Enter (return on a phone).
async function addIdea(page: Page, text: string) {
  await page.getByRole('button', { name: 'Add an idea', exact: true }).tap()
  const input = page.getByLabel('Edit idea')
  await expect(input).toBeFocused()
  await input.fill(text)
  await input.press('Enter')
  await expect(input).toHaveCount(0)
}

// Taps a box's words (not its dots or buttons).
async function tapBox(page: Page, number: string) {
  await box(page, number).locator('.idea__text').tap()
}

const nothingSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)

test('every page fits the width, with the nav bar on one row', async ({ page }) => {
  for (const route of ['', 'boards', 'privacy']) {
    await page.goto(`#/${route}`)
    await expect(page.getByRole('link', { name: 'Boards' })).toBeVisible()
    expect(await nothingSideways(page)).toBe(true)
    const right = await page.locator('.home__nav').evaluate((nav) => Math.max(...[...nav.querySelectorAll('a, button')].map((e) => e.getBoundingClientRect().right)))
    expect(right).toBeLessThanOrEqual(375)
  }
})

test('the board has a button bar, and the terminal waits behind >_', async ({ page }) => {
  await newBoard(page)
  await expect(page.getByRole('button', { name: 'Vending machine' })).toBeVisible()
  await expect(page.locator('.terminal')).toBeHidden()
  await page.getByRole('button', { name: 'Terminal' }).tap()
  await expect(page.getByLabel('Terminal command')).toBeFocused()
  // It opens below the board, so the board keeps its height.
  const gap = await page.evaluate(() => document.querySelector('.terminal')!.getBoundingClientRect().top - document.querySelector('.workspace__board')!.getBoundingClientRect().bottom)
  expect(gap).toBeGreaterThanOrEqual(-1)
})

test('new ideas stack down the screen in the order you add them', async ({ page }) => {
  await newBoard(page)
  await addIdea(page, 'one')
  await addIdea(page, 'two')
  await addIdea(page, 'three')
  const tops = await Promise.all(['1', '2', '3'].map(async (n) => (await box(page, n).boundingBox())!.y))
  expect(tops[0]).toBeLessThan(tops[1])
  expect(tops[1]).toBeLessThan(tops[2])
  // The newest is on screen, clear of the bar along the bottom.
  const newest = await box(page, '3').boundingBox()
  const bar = await page.locator('.selection-bar').boundingBox()
  expect(newest!.y + newest!.height).toBeLessThanOrEqual(bar!.y)
})

test('a tapped box has its actions in a bar: link, next, edit, favourite and delete', async ({ page }) => {
  await newBoard(page)
  await addIdea(page, 'a pocket sundial')
  await addIdea(page, 'a ring')
  await expect(links(page)).toHaveCount(0)

  // Link: tap link, then the other box.
  await tapBox(page, '2')
  await page.getByRole('button', { name: 'Link 2 to another box' }).tap()
  await tapBox(page, '1')
  await expect(links(page)).toHaveCount(1)

  // + next: a new idea, already linked. (The box you linked to is selected now, so its bar is up;
  // tapping it again straight away would be a double-tap, which edits it.)
  await expect(page.getByRole('toolbar', { name: 'Box 1' })).toBeVisible()
  await page.getByRole('button', { name: 'Add an idea linked to 1' }).tap()
  await page.getByLabel('Edit idea').fill('worn on a finger')
  await page.getByLabel('Edit idea').press('Enter')
  await expect(boxes(page)).toHaveCount(3)
  await expect(links(page)).toHaveCount(2)

  // Edit, favourite and delete.
  await tapBox(page, '3')
  await page.getByRole('button', { name: 'Edit 3' }).tap()
  await expect(page.getByLabel('Edit idea')).toBeFocused()
  await page.getByLabel('Edit idea').press('Enter')
  await tapBox(page, '3')
  await page.getByRole('button', { name: 'Favourite 3' }).tap()
  await expect(page.getByRole('button', { name: 'Unfavourite 3' })).toBeVisible()
  await page.getByRole('button', { name: 'Delete 3' }).tap()
  await expect(boxes(page)).toHaveCount(2)
})

test('the drawer opens below the board, with touch help instead of commands', async ({ page }) => {
  await newBoard(page)
  await page.getByRole('button', { name: 'Commands' }).tap()
  await expect(page.getByRole('tab', { name: 'help' })).toBeVisible()
  await expect(page.getByText('Do things with a box')).toBeVisible()
  // Measured together, as the page may still be scrolling down to it.
  const gap = await page.evaluate(() => document.querySelector('.panel')!.getBoundingClientRect().top - document.querySelector('.workspace__board')!.getBoundingClientRect().bottom)
  expect(gap).toBeGreaterThanOrEqual(-1)
  expect(await nothingSideways(page)).toBe(true)
})

test('undo and redo are buttons by the Menu', async ({ page }) => {
  await newBoard(page)
  const undo = page.getByRole('button', { name: 'Undo', exact: true })
  const redo = page.getByRole('button', { name: 'Redo', exact: true })
  await expect(undo).toBeDisabled()
  await addIdea(page, 'a pocket sundial')
  await undo.tap()
  await expect(boxes(page)).toHaveCount(0)
  await expect(redo).toBeEnabled()
  await redo.tap()
  await expect(boxes(page)).toHaveCount(1)
})
