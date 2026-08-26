import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import type { Browser } from 'playwright-core'
import { chromium } from 'playwright-core'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * The only test in this package that looks at a rendered interface.
 *
 * Everything here is invisible to a type-checker and to a DOM without layout: whether a pointer
 * aimed at an option reaches the option, and whether an element is on screen before anything has
 * positioned it. Both shipped, and both were found by clicking rather than by reading.
 *
 * A real browser is infrastructure, so a laptop without one may skip; CI must not.
 */

const root = fileURLToPath(new URL('./browser', import.meta.url))
const svelteConfig = fileURLToPath(new URL('../svelte.config.js', import.meta.url))

let server: ViteDevServer
let browser: Browser | null = null
let base = ''
let noBrowser = ''

beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root,
    plugins: [svelte({ configFile: svelteConfig })],
    // Port 0 lets the OS pick, so several checkouts can run this at once.
    server: { port: 0, host: '127.0.0.1' },
    logLevel: 'error',
  })
  await server.listen()
  base = server.resolvedUrls?.local[0] ?? ''

  try {
    browser = await chromium.launch()
  } catch (error) {
    if (process.env.CI) throw error
    noBrowser = `no Chromium: ${error instanceof Error ? error.message.split('\n')[0] : error}`
  }
}, 180_000)

afterAll(async () => {
  await browser?.close()
  await server?.close()
})

describe('a popup opened from a modal surface', () => {
  it('lets the pointer reach an option in a Select inside a Dialog', async (ctx) => {
    if (!browser) return ctx.skip(noBrowser)
    const page = await browser.newPage({ viewport: { width: 1024, height: 800 } })
    const crashes: string[] = []
    page.on('pageerror', (e) => crashes.push(String(e)))
    await page.goto(base)

    await page.click('#property-type')
    const option = page.locator('.ksel-item', { hasText: 'Multi-select' })
    await option.waitFor()

    /*
     * The assertion the bug failed. Playwright's own click does this check too, but it reports
     * it as a timeout, which reads like a slow page rather than a control nobody can reach.
     */
    const box = (await option.boundingBox()) as { x: number; y: number; width: number; height: number }
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const hit = await page.evaluate((point) => {
      const el = document.elementFromPoint(point.x, point.y)
      if (!el) return 'nothing'
      return el.closest('.ksel-content') ? 'the option' : `${el.tagName.toLowerCase()}.${el.className}`
    }, centre)
    expect(hit).toBe('the option')

    await option.click({ timeout: 3_000 })
    await expect.poll(() => page.locator('#chosen').innerText()).toBe('multi_select')

    const layers = await page.evaluate(() => ({
      overlay: getComputedStyle(document.querySelector('.kdlg-overlay') as Element).zIndex,
      popup: getComputedStyle(document.querySelector('.ksel-content') as Element).zIndex,
    }))
    expect(Number(layers.popup)).toBeGreaterThan(Number(layers.overlay))

    expect(crashes).toEqual([])
    await page.close()
  }, 60_000)

  it('keeps the drag grip off screen until the plugin places it', async (ctx) => {
    if (!browser) return ctx.skip(noBrowser)
    const page = await browser.newPage({ viewport: { width: 1024, height: 800 } })
    await page.goto(`${base}editor.html`)

    const grip = page.locator('.drag-handle')
    await grip.waitFor({ state: 'attached' })
    expect(await grip.evaluate((el) => getComputedStyle(el).visibility)).toBe('hidden')

    await page.close()
  }, 60_000)
})
