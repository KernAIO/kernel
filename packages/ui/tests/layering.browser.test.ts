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
    // /dev/shm is 64 MB in a CI container and Chromium will crash rather than say so.
    browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] })
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

describe('the slash menu', () => {
  it('inserts a block nothing else in the editor can reach', async (ctx) => {
    if (!browser) return ctx.skip(noBrowser)
    const page = await browser.newPage({ viewport: { width: 1024, height: 800 } })
    await page.goto(`${base}editor.html`)

    const surface = page.locator('.kern-prose')
    await surface.waitFor()
    await surface.click()

    // A callout has no shortcut, no toolbar and no markdown input rule: this is the only way in.
    await page.keyboard.type('/callout')
    const menu = page.locator('.kmenu.ksug')
    await menu.waitFor()
    const labels = await menu.locator('.kmenu-item .kmenu-l').allInnerTexts()
    expect(labels).toContain('Warning callout')
    expect(labels.every((l) => l.toLowerCase().includes('callout'))).toBe(true)

    // Keyboard only — the caret has to stay in the document the whole time.
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')

    await page.locator('.kern-prose aside.kern-callout').waitFor()
    expect(await page.locator('.kern-prose aside.kern-callout').getAttribute('data-callout')).toBe('success')
    // The `/callout` that opened the menu must not be left in the document.
    expect(await surface.innerText()).not.toContain('/callout')
    await page.close()
  }, 60_000)

  it('closes on Escape and leaves what was typed alone', async (ctx) => {
    if (!browser) return ctx.skip(noBrowser)
    const page = await browser.newPage({ viewport: { width: 1024, height: 800 } })
    await page.goto(`${base}editor.html`)

    const surface = page.locator('.kern-prose')
    await surface.waitFor()
    await surface.click()
    await page.keyboard.type('/table')
    await page.locator('.kmenu.ksug').waitFor()
    await page.keyboard.press('Escape')
    await page.locator('.kmenu.ksug').waitFor({ state: 'detached' })
    expect(await surface.innerText()).toContain('/table')
    await page.close()
  }, 60_000)

  /**
   * The same wiring, and it was missing too: `buildPageExtensions` has asked for `onSuggest` since
   * it was written, and `CollaborativeEditor` never passed it — so `@` in a wiki page opened
   * nothing at all, on a schema whose mention node was always there.
   */
  it('opens the people menu on @ in a page, which it never did', async (ctx) => {
    if (!browser) return ctx.skip(noBrowser)
    const page = await browser.newPage({ viewport: { width: 1024, height: 800 } })
    await page.goto(`${base}editor.html`)

    const surface = page.locator('.kern-prose')
    await surface.waitFor()
    await surface.click()
    await page.keyboard.type('Hello @ada')
    const menu = page.locator('.kmenu.ksug')
    await menu.waitFor()
    expect(await menu.locator('.kmenu-l').allInnerTexts()).toEqual(['Ada Lovelace'])

    await page.keyboard.press('Enter')
    await page.locator('.kern-prose .kern-mention').waitFor()
    expect(await surface.innerText()).toContain('Ada Lovelace')
    await page.close()
  }, 60_000)

  /**
   * Where a slash is a slash. The URL case is the destructive one: the menu would open on the two
   * slashes in `https://`, and Enter — which is what somebody types next — would replace the line
   * with a heading.
   */
  it('stays out of the way where a slash is not a command', async (ctx) => {
    if (!browser) return ctx.skip(noBrowser)
    const page = await browser.newPage({ viewport: { width: 1024, height: 800 } })
    const menu = page.locator('.kmenu.ksug')

    const type = async (...chunks: string[]) => {
      await page.goto(`${base}editor.html`)
      const surface = page.locator('.kern-prose')
      await surface.waitFor()
      await surface.click()
      for (const chunk of chunks) {
        await page.keyboard.type(chunk)
        // A chunk boundary is a pause: the fence is a markdown input rule, and everything after it
        // means something different once the rule has turned the line into a code block.
        await page.waitForTimeout(150)
      }
      await page.waitForTimeout(250)
      return menu.count()
    }

    expect(await type('see https://example.com/x')).toBe(0)
    expect(await type('```\n', 'const ratio = a /b')).toBe(0)
    expect(await page.locator('.kern-prose pre').count()).toBe(1)
    // …but a slash that follows a space is a command, wherever it is in the line.
    expect(await type('note /tab')).toBe(1)
    await page.close()
  }, 60_000)

  it('stays on screen and in the right language in Persian', async (ctx) => {
    if (!browser) return ctx.skip(noBrowser)
    const page = await browser.newPage({ viewport: { width: 1024, height: 800 } })
    await page.goto(`${base}editor.html?dir=rtl`)

    const surface = page.locator('.kern-prose')
    await surface.waitFor()
    await surface.click()
    await page.keyboard.type('/')
    const menu = page.locator('.kmenu.ksug')
    await menu.waitFor()

    expect(await menu.locator('.kmenu-item .kmenu-l').first().innerText()).toBe('متن')
    const box = (await menu.boundingBox()) as { x: number; width: number }
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(1024)
    await page.close()
  }, 60_000)
})
