import { expect, type Page } from '@playwright/test'

// A fresh, blank board with no theme. Each test gets its own browser storage.
export async function newBoard(page: Page) {
  await page.goto('#/new')
  await page.getByRole('button', { name: 'skip' }).click()
  await expect(page.locator('.board__empty')).toBeVisible()
}

export async function type(page: Page, line: string) {
  const terminal = page.getByLabel('Terminal command')
  await terminal.fill(line)
  await terminal.press('Enter')
}

export const boxes = (page: Page) => page.locator('.react-flow__node')
// A box by its number, as shown on it ("n3" or "3" both mean box 3).
export const box = (page: Page, number: string) =>
  page.locator('.react-flow__node').filter({ has: page.locator(`.idea[data-number="${number.replace(/^n/, '')}"]`) })
export const links = (page: Page) => page.locator('.react-flow__edge')
