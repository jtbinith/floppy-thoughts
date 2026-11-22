import { expect, test } from '@playwright/test'
import { box, boxes, links, newBoard, type } from './helpers'

// Behaviour the board's workspace looks after, pinned down before it's split into smaller files.

test.beforeEach(async ({ page }) => {
  await newBoard(page)
})

test.describe('editing ideas', () => {
  test('Enter saves an edit', async ({ page }) => {
    await type(page, 'clocks')
    await page.getByLabel('Terminal command').press('Escape')
    await page.keyboard.press('Enter')
    const editor = page.getByLabel('Edit idea')
    await editor.fill('clocks that grow')
    await editor.press('Enter')
    await expect(editor).toBeHidden()
    await expect(box(page, 'n1')).toContainText('clocks that grow')
  })

  test('Tab while editing saves, and starts a new idea linked to it', async ({ page }) => {
    await type(page, 'clocks')
    await page.getByLabel('Terminal command').press('Escape')
    await page.keyboard.press('Enter')
    await page.getByLabel('Edit idea').fill('clocks that grow')
    await page.getByLabel('Edit idea').press('Tab')
    await expect(boxes(page)).toHaveCount(2)
    await expect(links(page)).toHaveCount(1)
    await expect(box(page, 'n1')).toContainText('clocks that grow')
    await expect(page.getByLabel('Edit idea')).toBeFocused()
  })

  test('Esc on an empty new idea takes it back off the board', async ({ page }) => {
    await page.getByRole('button', { name: 'Add an idea' }).first().click()
    await expect(page.getByLabel('Edit idea')).toBeFocused()
    await page.getByLabel('Edit idea').press('Escape')
    await expect(boxes(page)).toHaveCount(0)
  })
})

test('redo puts back what undo took away', async ({ page }) => {
  await type(page, 'one')
  await type(page, 'two')
  await type(page, '/undo')
  await expect(boxes(page)).toHaveCount(1)
  await type(page, '/redo')
  await expect(boxes(page)).toHaveCount(2)
})

test('the board can be renamed from its title', async ({ page }) => {
  await page.locator('.screen__name-button').click()
  const name = page.getByLabel('Board name')
  await name.fill('time machines')
  await name.press('Enter')
  await expect(page.locator('.screen__name-button')).toHaveText('time machines')
})

test('favourites show in the drawer, and can go on a new board', async ({ page }) => {
  await type(page, 'keep this')
  await type(page, 'and this')
  await type(page, '/fav 1')
  await type(page, '/fav 2')
  await page.getByRole('button', { name: 'Favourites', exact: true }).click()
  await expect(page.locator('.favs__item')).toHaveCount(2)
  await page.getByRole('button', { name: 'put these on a new board' }).click()
  await expect(page.locator('.screen__name-button')).toContainText('favourites')
  await expect(boxes(page)).toHaveCount(2)
})

test('ticked favourites can go on a new board on their own', async ({ page }) => {
  await type(page, 'keep this')
  await type(page, 'and this')
  await type(page, 'and this too')
  await type(page, '/fav 1')
  await type(page, '/fav 2')
  await type(page, '/fav 3')
  await page.getByRole('button', { name: 'Favourites', exact: true }).click()
  await page.getByLabel('Tick keep this for a new board').check()
  await page.getByLabel('Tick and this too for a new board').check()
  await page.getByRole('button', { name: 'put the 2 ticked on a new board' }).click()
  await expect(page.locator('.screen__name-button')).toContainText('favourites')
  await expect(boxes(page)).toHaveCount(2)
})

test('/favboard with numbers puts just those favourites on a new board', async ({ page }) => {
  await type(page, 'keep this')
  await type(page, 'and this')
  await type(page, 'not this')
  await type(page, '/fav 1')
  await type(page, '/fav 2')
  await type(page, '/favboard 1 3')
  await expect(page.locator('.terminal')).toContainText("3 isn't a favourite")
  await type(page, '/favboard 2')
  await expect(page.locator('.screen__name-button')).toContainText('favourites')
  await expect(boxes(page)).toHaveCount(1)
})

test('favouriting ideas puts them in the summary, with how you got there', async ({ page }) => {
  await type(page, '/theme Plants')
  await type(page, 'a plant that texts you')
  await type(page, 'a moss clock')
  await type(page, '/link 1 2')
  // F on a selected box favourites it.
  await box(page, 'n2').click()
  await page.keyboard.press('f')
  await expect(page.locator('.screen__summary')).toHaveText('♥ my idea')
  await type(page, '/fav 3')
  await page.locator('.screen__summary').click()
  const summary = page.getByRole('dialog', { name: 'Your favourite ideas' })
  await expect(summary.locator('.summary__idea')).toHaveText(['♥ a plant that texts you', '♥ a moss clock'])
  await expect(summary).toContainText('Plants')
})

test('a theme added later sits beside the first, and one undo takes it back', async ({ page }) => {
  await type(page, '/theme Time')
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  await page.getByRole('menuitem', { name: 'Add a theme…' }).click()
  await page.getByLabel('Theme', { exact: true }).fill('Space')
  await page.getByRole('button', { name: 'add theme' }).click()
  await expect(boxes(page)).toHaveCount(2)
  const [a, b] = await Promise.all([box(page, 'n1').boundingBox(), box(page, 'n2').boundingBox()])
  expect(b!.x).toBeGreaterThan(a!.x + a!.width - 1)
  await type(page, '/undo')
  await expect(boxes(page)).toHaveCount(1)
})

test('a vended note lands next to the selected box', async ({ page }) => {
  await type(page, 'far away')
  await type(page, 'start here')
  // n2 is the newest, so it is selected: the note should land beside it.
  await type(page, '/vend words')
  const out = page.getByRole('dialog', { name: 'A note from the vending machine' })
  await expect(out).toBeVisible({ timeout: 10_000 })
  await type(page, '/stick')
  await expect(boxes(page)).toHaveCount(3)
  const [anchor, note] = await Promise.all([box(page, 'n2').boundingBox(), box(page, 'n3').boundingBox()])
  const gap = Math.hypot(note!.x - anchor!.x, note!.y - anchor!.y)
  expect(gap).toBeLessThan(450)
})

test('deleting a board asks first, then it goes', async ({ page }) => {
  await type(page, 'short-lived')
  await page.getByRole('menuitem', { name: 'Board' }).click()
  await page.getByRole('menuitem', { name: 'Delete this board…' }).click()
  await page.getByRole('button', { name: 'keep it' }).click()
  await expect(boxes(page)).toHaveCount(1)
  await page.getByRole('menuitem', { name: 'Board' }).click()
  await page.getByRole('menuitem', { name: 'Delete this board…' }).click()
  await page.getByRole('button', { name: 'delete board' }).click()
  await expect(page).toHaveURL(/#\/boards/)
  await expect(page.getByText('short-lived')).toHaveCount(0)
})

test('deleting the board you are in takes you to the boards page, even with other boards', async ({ page }) => {
  await type(page, '/rename keeper')
  await type(page, '/new')
  await page.getByRole('button', { name: 'skip' }).click()
  await type(page, '/rename short-lived')
  await page.getByRole('menuitem', { name: 'Board' }).click()
  await page.getByRole('menuitem', { name: 'Delete this board…' }).click()
  await page.getByRole('button', { name: 'delete board' }).click()
  await expect(page).toHaveURL(/#\/boards$/)
  await expect(page.locator('.boards__card strong')).toHaveText(['keeper'])
})

test('everything is still there after a reload', async ({ page }) => {
  await type(page, '/theme Time')
  await type(page, 'clocks that grow')
  await type(page, '/link 1 2')
  await type(page, '/fav 2')
  await page.reload()
  await expect(boxes(page)).toHaveCount(2)
  await expect(links(page)).toHaveCount(1)
  await expect(box(page, 'n2')).toContainText('clocks that grow')
  await expect(box(page, 'n2').locator('.idea__fav-mark')).toBeVisible()
})

test('boxes glide back when a tidy is undone, instead of jumping', async ({ page }) => {
  await type(page, 'one')
  await type(page, 'two')
  await type(page, 'three')
  await type(page, '/link 1 2')
  await type(page, '/link 2 3')
  const where = () => box(page, 'n3').evaluate((n) => (n as HTMLElement).style.transform)
  const start = await where()
  await type(page, '/tidy')
  await expect.poll(where).not.toBe(start)
  const tidied = await where()
  await page.waitForTimeout(600)
  await type(page, '/undo')
  // Part-way back a moment later (neither where it was tidied to nor where it started)…
  await page.waitForTimeout(120)
  const between = await where()
  expect(between).not.toBe(start)
  expect(between).not.toBe(tidied)
  // …and then all the way back.
  await expect.poll(where).toBe(start)
})

test('down-voting a box takes away your favourite, and the heart takes away the down-vote', async ({ page }) => {
  await type(page, 'a pocket sundial')
  await box(page, 'n1').click()
  await page.getByRole('button', { name: 'Favourite 1' }).click()
  await expect(page.getByRole('button', { name: 'Unfavourite 1' })).toBeVisible()
  await page.getByRole('button', { name: 'Down-vote 1' }).click()
  await expect(page.getByRole('button', { name: 'Take back your down-vote on 1' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Favourite 1' })).toBeVisible()
  // Off the box, the down-vote mark shows (just yours: nobody else is on this board).
  await page.locator('.react-flow__pane').click({ position: { x: 10, y: 10 } })
  await expect(box(page, 'n1').locator('.idea__down-mark')).toBeVisible()
  await expect(box(page, 'n1').locator('.idea__count')).toHaveCount(0)
  await type(page, '/down 1')
  await expect(box(page, 'n1').locator('.idea__down-mark')).toHaveCount(0)
})
