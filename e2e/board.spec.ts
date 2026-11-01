import { expect, test } from '@playwright/test'
import { box, boxes, links, newBoard, type } from './helpers'

test.beforeEach(async ({ page }) => {
  await newBoard(page)
})

test.describe('adding ideas', () => {
  test('a typed thought becomes an idea, and is selected', async ({ page }) => {
    await type(page, 'clocks that grow')
    await expect(boxes(page)).toHaveCount(1)
    await expect(box(page, 'n1')).toHaveClass(/selected/)
    await expect(box(page, 'n1')).toContainText('clocks that grow')
  })

  test('only the newest idea is selected', async ({ page }) => {
    await type(page, 'first')
    await type(page, 'second')
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(1)
    await expect(box(page, 'n2')).toHaveClass(/selected/)
  })

  test('commands still work, and look-alike thoughts are added as ideas', async ({ page }) => {
    await type(page, 'help my nan with video calls')
    await expect(box(page, 'n1')).toContainText('help my nan with video calls')
  })
})

test.describe('deleting', () => {
  test('the × on a new idea deletes it', async ({ page }) => {
    await type(page, 'delete me')
    await box(page, 'n1').locator('.idea__delete').click()
    await expect(boxes(page)).toHaveCount(0)
  })

  test('Esc in the terminal, then Delete, deletes the new idea', async ({ page }) => {
    await type(page, 'delete me')
    await page.getByLabel('Terminal command').press('Escape')
    await page.keyboard.press('Delete')
    await expect(boxes(page)).toHaveCount(0)
  })

  test('clicking an idea, then Delete, deletes it', async ({ page }) => {
    await type(page, 'one')
    await type(page, 'two')
    await box(page, 'n1').click()
    await page.keyboard.press('Delete')
    await expect(boxes(page)).toHaveCount(1)
    await expect(box(page, 'n2')).toBeVisible()
  })

  test('deleting from the middle of a chain asks, and can keep it connected', async ({ page }) => {
    for (const line of ['a', 'b', 'c', 'link n1 n2', 'link n2 n3']) await type(page, line)
    await type(page, 'delete n2')
    await expect(page.getByRole('dialog', { name: 'Keep the chain connected?' })).toBeVisible()
    await page.getByRole('button', { name: 'keep it connected' }).click()
    await expect(boxes(page)).toHaveCount(2)
    await expect(links(page)).toHaveCount(1)
  })

  test('undo brings a deleted idea back', async ({ page }) => {
    await type(page, 'keep me')
    await type(page, 'delete n1')
    await expect(boxes(page)).toHaveCount(0)
    await type(page, 'undo')
    await expect(boxes(page)).toHaveCount(1)
  })
})

test.describe('links and layout', () => {
  test('link one idea to several at once', async ({ page }) => {
    for (const line of ['a', 'b', 'c', 'link n1 n2 n3']) await type(page, line)
    await expect(links(page)).toHaveCount(2)
  })

  test('dragging from a dot onto another box links them', async ({ page }) => {
    await type(page, 'from here')
    await type(page, 'to here')
    await type(page, 'fit')
    const from = box(page, 'n1')
    await from.hover()
    const dot = await from.locator('.react-flow__handle.source').boundingBox()
    const target = await box(page, 'n2').boundingBox()
    await page.mouse.move(dot!.x + dot!.width / 2, dot!.y + dot!.height / 2)
    await page.mouse.down()
    await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, { steps: 10 })
    // While dragging over a box, the preview snaps to it.
    await expect(page.locator('.link-preview--snapped')).toBeVisible()
    await page.mouse.up()
    await expect(links(page)).toHaveCount(1)
  })

  test('the fit button and the fit command frame the board the same way', async ({ page }) => {
    for (const line of ['a', 'b', 'c', 'd', 'link n1 n2 n3 n4']) await type(page, line)
    const viewport = () => page.locator('.react-flow__viewport').getAttribute('style')
    await page.mouse.move(600, 400)
    await page.mouse.wheel(0, 900)
    await page.getByRole('button', { name: 'Fit View' }).click()
    await page.waitForTimeout(500)
    const fromButton = await viewport()
    await page.mouse.wheel(0, 900)
    await type(page, 'fit')
    await page.waitForTimeout(500)
    expect(await viewport()).toBe(fromButton)
  })

  test('tidy moves things, and one undo puts them back', async ({ page }) => {
    for (const line of ['a', 'b', 'c', 'd', 'link n1 n2', 'link n3 n4']) await type(page, line)
    const before = await boxes(page).evaluateAll((ns) => ns.map((n) => (n as HTMLElement).style.transform))
    await type(page, 'tidy')
    await expect.poll(() => boxes(page).evaluateAll((ns) => ns.map((n) => (n as HTMLElement).style.transform))).not.toEqual(before)
    await page.waitForTimeout(600)
    await type(page, 'undo')
    await expect.poll(() => boxes(page).evaluateAll((ns) => ns.map((n) => (n as HTMLElement).style.transform))).toEqual(before)
  })
})

test.describe('starting a board', () => {
  test('a new board asks for a theme, which becomes the main theme', async ({ page }) => {
    await page.goto('#/new')
    await page.getByLabel('Main theme').fill('Time')
    await page.getByRole('button', { name: 'set theme' }).click()
    await expect(box(page, 'n1')).toContainText('Time')
    await expect(box(page, 'n1')).toContainText('main-theme')
  })
})

test.describe('the vending machine', () => {
  test('a note from the machine goes on the board only when you stick it', async ({ page }) => {
    await page.getByRole('menuitem', { name: 'View' }).click()
    await page.getByRole('menuitem', { name: 'Vending machine' }).click()
    await page.getByRole('button', { name: /words \(key W\)/ }).click()
    const popup = page.getByRole('dialog', { name: 'A new note from the vending machine' })
    await expect(popup).toBeVisible()
    await expect(boxes(page)).toHaveCount(0)
    await page.getByRole('button', { name: 'stick it on the board' }).click()
    await expect(boxes(page)).toHaveCount(1)
    await expect(box(page, 'n1')).toHaveClass(/selected/)
  })

  test('putting a note back leaves the board alone', async ({ page }) => {
    await type(page, 'vend')
    await page.getByRole('button', { name: 'put it back' }).click()
    await expect(boxes(page)).toHaveCount(0)
  })
})

test.describe('terminal', () => {
  test('Ctrl+C cancels the line', async ({ page }) => {
    const terminal = page.getByLabel('Terminal command')
    await terminal.fill('half a thought')
    await terminal.press('Control+c')
    await expect(terminal).toHaveValue('')
    await expect(boxes(page)).toHaveCount(0)
  })

})

test.describe('commands tab', () => {
  test('help opens the commands beside the board, and clicking one puts it in the terminal', async ({ page }) => {
    await type(page, 'help')
    const tab = page.getByRole('complementary', { name: 'Commands' })
    await expect(tab).toBeVisible()
    await tab.locator('.commands__entry', { hasText: 'unlink' }).click()
    await expect(page.getByLabel('Terminal command')).toHaveValue('unlink ')
    await expect(page.getByLabel('Terminal command')).toBeFocused()
  })

  test('the drawer tabs stay full height above a long tab', async ({ page }) => {
    await type(page, 'help')
    const tabs = page.locator('.panel__tabs')
    expect((await tabs.boundingBox())!.height).toBeGreaterThan(25)
  })

})

test.describe('nudges', () => {
  test('a selected idea has its own nudge button', async ({ page }) => {
    await type(page, 'a kettle that sings')
    await box(page, 'n1').getByRole('button', { name: 'Nudge n1' }).click()
    await expect(page.locator('.idea--nudge')).toHaveCount(1)
  })
})

test.describe('switching boards', () => {
  test('recent boards are in the Board menu, one click away', async ({ page }) => {
    await type(page, 'rename first board')
    await type(page, 'new')
    await page.getByRole('button', { name: 'skip' }).click()
    await page.getByRole('menuitem', { name: 'Board' }).click()
    await page.getByRole('menuitem', { name: 'first board' }).click()
    await expect(page.locator('.screen__name-button')).toHaveText('first board')
  })

  test('All boards… goes to the boards page', async ({ page }) => {
    await page.getByRole('menuitem', { name: 'Board' }).click()
    await page.getByRole('menuitem', { name: 'All boards…' }).click()
    await expect(page.getByRole('heading', { name: 'my boards' })).toBeVisible()
  })

  test('the drawer has no boards tab', async ({ page }) => {
    await type(page, 'help')
    await expect(page.getByRole('tab', { name: 'boards' })).toHaveCount(0)
  })
})
