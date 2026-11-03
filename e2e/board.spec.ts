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

  test('anything without a / is a thought, even if it starts like a command', async ({ page }) => {
    await type(page, 'link music and maths')
    await type(page, 'tidy my desk')
    await expect(boxes(page)).toHaveCount(2)
    await expect(box(page, 'n1')).toContainText('link music and maths')
  })

  test('a mistyped command explains itself instead of becoming an idea', async ({ page }) => {
    await type(page, '/link n1')
    await expect(page.locator('.terminal__line').last()).toContainText('usage: /link')
    await expect(boxes(page)).toHaveCount(0)
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
    for (const line of ['a', 'b', 'c', '/link n1 n2', '/link n2 n3']) await type(page, line)
    await type(page, '/del n2')
    await expect(page.getByRole('dialog', { name: 'Keep the chain connected?' })).toBeVisible()
    await page.getByRole('button', { name: 'keep it connected' }).click()
    await expect(boxes(page)).toHaveCount(2)
    await expect(links(page)).toHaveCount(1)
  })

  test('undo brings a deleted idea back', async ({ page }) => {
    await type(page, 'keep me')
    await type(page, '/delete n1')
    await expect(boxes(page)).toHaveCount(0)
    await type(page, '/undo')
    await expect(boxes(page)).toHaveCount(1)
  })
})

test.describe('links and layout', () => {
  test('link one idea to several at once', async ({ page }) => {
    for (const line of ['a', 'b', 'c', '/link n1 n2 n3']) await type(page, line)
    await expect(links(page)).toHaveCount(2)
  })

  test('dragging from a dot onto another box links them', async ({ page }) => {
    await type(page, 'from here')
    await type(page, 'to here')
    await type(page, '/fit')
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
    for (const line of ['a', 'b', 'c', 'd', '/link n1 n2 n3 n4']) await type(page, line)
    const viewport = () => page.locator('.react-flow__viewport').getAttribute('style')
    await page.mouse.move(600, 400)
    await page.mouse.wheel(0, 900)
    await page.getByRole('button', { name: 'Fit View' }).click()
    await page.waitForTimeout(500)
    const fromButton = await viewport()
    await page.mouse.wheel(0, 900)
    await type(page, '/fit')
    await page.waitForTimeout(500)
    expect(await viewport()).toBe(fromButton)
  })

  test('tidy moves things, and one undo puts them back', async ({ page }) => {
    for (const line of ['a', 'b', 'c', 'd', '/link n1 n2', '/link n3 n4']) await type(page, line)
    const before = await boxes(page).evaluateAll((ns) => ns.map((n) => (n as HTMLElement).style.transform))
    await type(page, '/tidy')
    await expect.poll(() => boxes(page).evaluateAll((ns) => ns.map((n) => (n as HTMLElement).style.transform))).not.toEqual(before)
    await page.waitForTimeout(600)
    await type(page, '/undo')
    await expect.poll(() => boxes(page).evaluateAll((ns) => ns.map((n) => (n as HTMLElement).style.transform))).toEqual(before)
  })
})

test.describe('starting a board', () => {
  test('a new board asks for themes, as many as you like', async ({ page }) => {
    await page.goto('#/new')
    await page.getByLabel('Theme', { exact: true }).fill('Time')
    await page.getByLabel('Theme', { exact: true }).press('Enter')
    await page.getByLabel('Theme', { exact: true }).fill('Sustainability')
    await page.getByRole('button', { name: 'add 2 themes' }).click()
    await expect(box(page, 'n1')).toContainText('Time')
    await expect(box(page, 'n1')).toContainText('theme')
    await expect(box(page, 'n2')).toContainText('Sustainability')
  })
})

test.describe('the vending machine', () => {
  test('a note from the machine goes on the board only when you stick it', async ({ page }) => {
    await page.getByRole('menuitem', { name: 'View' }).click()
    await page.getByRole('menuitem', { name: 'Vending machine' }).click()
    // The 3D machine takes focus; a row letter and Enter vend from that row.
    await expect(page.locator('.panel__machine .home__machine')).toBeFocused()
    await page.keyboard.press('a')
    await page.keyboard.press('Enter')
    // The token cracks open and the note comes out as a note box.
    const scroll = page.getByRole('dialog', { name: 'A note from the vending machine' })
    await expect(scroll).toBeVisible({ timeout: 10_000 })
    await expect(scroll).toContainText('word')
    await expect(boxes(page)).toHaveCount(0)
    await scroll.getByRole('button', { name: 'stick on board' }).click()
    await expect(boxes(page)).toHaveCount(1)
    await expect(scroll).toBeHidden()
  })

  test('putting a note back leaves the board alone', async ({ page }) => {
    await page.getByRole('menuitem', { name: 'View' }).click()
    await page.getByRole('menuitem', { name: 'Vending machine' }).click()
    await expect(page.locator('.panel__machine .home__machine')).toBeFocused()
    await page.keyboard.press('?')
    const scroll = page.getByRole('dialog', { name: 'A note from the vending machine' })
    await scroll.getByRole('button', { name: 'put back' }).click({ timeout: 10_000 })
    await expect(boxes(page)).toHaveCount(0)
  })

  test('/vend in the terminal runs the machine; /swap and /stick deal with the note', async ({ page }) => {
    await type(page, '/vend nature')
    const out = page.getByRole('dialog', { name: 'A note from the vending machine' })
    await expect(out).toBeVisible({ timeout: 10_000 })
    await expect(out).toContainText('nature')
    const first = await out.locator('.idea__text').textContent()
    await type(page, '/swap')
    await expect(out.locator('.idea__text')).not.toHaveText(first!)
    await type(page, '/stick')
    await expect(boxes(page)).toHaveCount(1)
    await expect(box(page, 'n1')).toContainText('nature')
  })

  test('/stick with nothing out says so', async ({ page }) => {
    await type(page, '/stick')
    await expect(page.locator('.terminal__line--error').last()).toContainText('no note is out of the machine')
  })
})

test.describe('terminal', () => {
  test('/ and Ctrl+` both jump back to the terminal from the board', async ({ page }) => {
    await type(page, 'an idea')
    const terminal = page.getByLabel('Terminal command')
    await terminal.press('Escape')
    await expect(terminal).not.toBeFocused()
    await page.keyboard.press('/')
    await expect(terminal).toBeFocused()
    // "/" starts a command, so it's already typed.
    await expect(terminal).toHaveValue('/')
    await terminal.fill('')
    await terminal.press('Escape')
    await page.keyboard.press('Control+Backquote')
    await expect(terminal).toBeFocused()
  })

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
    await type(page, '/help')
    const tab = page.getByRole('complementary', { name: 'Commands' })
    await expect(tab).toBeVisible()
    await tab.locator('.commands__entry', { hasText: 'unlink' }).click()
    await expect(page.getByLabel('Terminal command')).toHaveValue('/unlink ')
    await expect(page.getByLabel('Terminal command')).toBeFocused()
  })

  test('the drawer tabs stay full height above a long tab', async ({ page }) => {
    await type(page, '/help')
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
    await type(page, '/rename first board')
    await type(page, '/new')
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

  test('the boards page finds boards by their thoughts, and sorts them', async ({ page }) => {
    await type(page, '/rename zebra')
    await type(page, 'a kettle that sings')
    await type(page, '/new')
    await page.getByRole('button', { name: 'skip' }).click()
    await type(page, '/rename apple')
    await page.goto('#/boards')
    const cards = page.locator('.boards__card strong')
    await expect(cards).toHaveText(['apple', 'zebra'])

    await page.getByLabel('Search boards').fill('KETTLE')
    await expect(cards).toHaveText(['zebra'])
    await page.getByLabel('Search boards').fill('nothing like this')
    await expect(page.getByText('No boards match')).toBeVisible()

    await page.getByLabel('Search boards').fill('')
    await page.getByLabel('sort by').selectOption('name')
    await expect(cards).toHaveText(['apple', 'zebra'])
    await page.getByLabel('sort by').selectOption('oldest')
    await expect(cards).toHaveText(['zebra', 'apple'])
  })

  test('the nav bar links to my boards, and the logo goes home', async ({ page }) => {
    await page.goto('#/')
    const nav = page.getByRole('navigation', { name: 'Pages' })
    await nav.getByRole('link', { name: 'my boards' }).click()
    await expect(nav.getByRole('link', { name: 'my boards' })).toHaveAttribute('aria-current', 'page')
    await page.getByRole('link', { name: 'Floppy Thoughts' }).click()
    await expect(page.getByRole('heading', { name: /ideas worth/ })).toBeVisible()
  })

  test('the sun/moon button switches dark and light mode, and remembers it', async ({ page }) => {
    await page.goto('#/')
    const html = page.locator('html')
    const before = await html.getAttribute('data-theme')
    const after = before === 'light' ? 'dark' : 'light'
    await page.getByRole('button', { name: `Switch to ${after} mode` }).click()
    await expect(html).toHaveAttribute('data-theme', after)
    await page.reload()
    await expect(html).toHaveAttribute('data-theme', after)
  })

  test('the drawer has no boards tab', async ({ page }) => {
    await type(page, '/help')
    await expect(page.getByRole('tab', { name: 'boards' })).toHaveCount(0)
  })
})

test.describe('ids as numbers', () => {
  test('you can type plain numbers', async ({ page }) => {
    for (const line of ['a', 'b', 'c', '/link 1 2 3']) await type(page, line)
    await expect(links(page)).toHaveCount(2)
  })

  test('Tab finds a thought by its words and fills in its number', async ({ page }) => {
    await type(page, 'clocks that grow')
    await type(page, 'a bag that remembers')
    const terminal = page.getByLabel('Terminal command')
    await terminal.fill('/link 1 bag')
    await terminal.press('Tab')
    await expect(terminal).toHaveValue('/link 1 2 ')
  })

  test('numbers only show on boxes while you type a command', async ({ page }) => {
    await type(page, 'an idea')
    const id = box(page, 'n1').locator('.idea__id')
    await expect(id).toBeHidden()
    await page.getByLabel('Terminal command').fill('/fav ')
    await expect(id).toBeVisible()
    await expect(id).toHaveText('1')
    await page.getByLabel('Terminal command').fill('just a thought')
    await expect(id).toBeHidden()
  })
})

test.describe('unlinking', () => {
  test('/unlink with one number clears its links, and undo brings them back', async ({ page }) => {
    for (const line of ['hub', 'a', 'b', '/link 1 2 3']) await type(page, line)
    await expect(links(page)).toHaveCount(2)
    await type(page, '/unlink 1')
    await expect(links(page)).toHaveCount(0)
    await expect(boxes(page)).toHaveCount(3)
    await type(page, '/undo')
    await expect(links(page)).toHaveCount(2)
  })
})

test.describe('keyboard, vim-style', () => {
  // Two ideas, then Esc from the terminal to put the focus on the board (the newest is selected).
  async function twoIdeas(page: import('@playwright/test').Page) {
    await type(page, 'first')
    await type(page, 'second')
    await page.getByLabel('Terminal command').press('Escape')
    await expect(box(page, 'n2')).toHaveClass(/selected/)
  }

  test('h j k l move the selection between boxes', async ({ page }) => {
    await twoIdeas(page)
    // Wherever the first one landed, one of the four directions reaches it.
    for (const key of ['h', 'l', 'k', 'j']) {
      await page.keyboard.press(key)
      if (await box(page, 'n1').evaluate((n) => n.classList.contains('selected'))) break
    }
    await expect(box(page, 'n1')).toHaveClass(/selected/)
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(1)
  })

  test('c on one box and c on another links them', async ({ page }) => {
    await twoIdeas(page)
    await page.keyboard.press('c')
    for (const key of ['h', 'l', 'k', 'j']) {
      await page.keyboard.press(key)
      if (await box(page, 'n1').evaluate((n) => n.classList.contains('selected'))) break
    }
    await page.keyboard.press('c')
    await expect(links(page)).toHaveCount(1)
  })

  test('x deletes, u brings it back', async ({ page }) => {
    await twoIdeas(page)
    await page.keyboard.press('x')
    await expect(boxes(page)).toHaveCount(1)
    await page.keyboard.press('u')
    await expect(boxes(page)).toHaveCount(2)
  })

  test('o adds a linked idea to type into; ? shows the shortcuts', async ({ page }) => {
    await twoIdeas(page)
    await page.keyboard.press('o')
    await expect(boxes(page)).toHaveCount(3)
    await expect(links(page)).toHaveCount(1)
    // Esc on the empty new idea takes it back off; the focus stays on the board.
    await page.keyboard.press('Escape')
    await expect(boxes(page)).toHaveCount(2)
    await expect(page.locator('.react-flow__node.selected, .react-flow:focus')).not.toHaveCount(0)
    await page.keyboard.press('?')
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible()
  })
})
