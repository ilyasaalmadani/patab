#!/usr/bin/env node
/**
 * Optional browser smoke test. Requires Google Chrome:
 *   npm install
 *   npm run test:e2e
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const BASE_URL = process.env.PATAB_URL || 'http://127.0.0.1:4173';
const PALETTE_SHORTCUT = process.platform === 'darwin' ? 'Meta+k' : 'Control+k';

async function waitForServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 150));
  }
  throw new Error(`Dev server did not start at ${url}`);
}

async function main() {
  const server = spawn(process.execPath, [resolve(ROOT, 'scripts/dev.mjs')], {
    cwd: ROOT,
    stdio: 'ignore',
    env: { ...process.env, PORT: '4173' },
  });

  let browser;
  try {
    await waitForServer(BASE_URL);
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];

    page.on('console', (message) => {
      if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) {
        errors.push(message.text());
      }
    });
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

    await page.addInitScript(() => {
      if (!sessionStorage.getItem('patab-e2e')) {
        localStorage.clear();
        sessionStorage.setItem('patab-e2e', '1');
      }
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    const tiles = page.locator('#tiles .tile:not(.tile--add)');
    assert.equal(await tiles.count(), 9, 'seed state has nine tiles');

    await page.locator('.panel--links [data-action="add-link"]').first().click();
    await page.locator('#linkTitle').fill('Example');
    await page.locator('#linkUrl').fill('example.com');
    await page.locator('#linkForm button[type="submit"]').click();
    await page.waitForTimeout(250);
    assert.equal(await tiles.count(), 10, 'a link can be added');

    const exampleTile = page.locator('.tile', { hasText: 'Example' });
    await exampleTile.hover();
    await exampleTile.locator('[data-action="edit-tile"]').click();
    await page.locator('#linkTitle').fill('Example Org');
    await page.locator('#linkForm button[type="submit"]').click();
    await page.waitForTimeout(200);
    assert.equal(
      await page.locator('.tile__title', { hasText: 'Example Org' }).count(),
      1,
      'a link can be edited',
    );

    await page.locator('.panel--links [data-action="add-folder"]').click();
    await page.locator('#folderTitle').fill('Research');
    const folderRow = page.locator('.folder-row').first();
    await folderRow.locator('input').nth(0).fill('arXiv');
    await folderRow.locator('input').nth(1).fill('arxiv.org');
    await page.locator('#folderForm button[type="submit"]').click();
    await page.waitForTimeout(250);

    const folderTile = page.locator('.tile', { hasText: 'Research' });
    assert.equal(await folderTile.count(), 1, 'a folder can be added');
    await folderTile.locator('.tile__main').click();
    await page.waitForTimeout(250);
    assert.equal(
      await page.locator('#folderViewDialog').evaluate((dialog) => dialog.open),
      true,
      'folder view opens',
    );
    assert.equal(
      await page.locator('#folderList .folder-item', { hasText: 'arXiv' }).count(),
      1,
      'folder contents render',
    );
    await page.locator('#folderViewDialog [data-close]').click();

    await page.locator('#taskInput').fill('Ship PATAB');
    await page.locator('#taskForm button[type="submit"]').click();
    await page.waitForTimeout(200);
    const newTask = page.locator('.task', { hasText: 'Ship PATAB' });
    assert.equal(await newTask.count(), 1, 'a task can be added');
    await newTask.locator('[data-action="toggle-task"]').click();
    await page.waitForTimeout(150);
    assert.equal(await newTask.getAttribute('data-done'), 'true', 'a task can be completed');

    await page.locator('#notes').fill('A quiet test note.');
    await page.waitForTimeout(800);
    assert.equal(await page.locator('#noteStatus').textContent(), 'Saved', 'notes autosave');

    const beforeTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.locator('#themeToggle').click();
    await page.waitForTimeout(250);
    const afterTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    assert.notEqual(beforeTheme, afterTheme, 'theme toggles');

    await page.locator('[data-action="open-settings"]').first().click();
    await page.locator('[data-action="pick-accent"][data-accent-id="violet"]').click();
    await page.waitForTimeout(200);
    assert.equal(
      await page.evaluate(() => document.documentElement.dataset.accent),
      'violet',
      'accent changes',
    );
    await page.locator('#settingsDialog [data-close]').click();

    await page.locator('#searchInput').fill('linear');
    await page.waitForTimeout(300);
    const searchText = await page.locator('#searchResults').innerText();
    assert.match(searchText, /Linear/, 'search finds a nested folder link');
    assert.match(searchText, /Studio/, 'search shows folder context');
    await page.keyboard.press('Escape');

    await page.keyboard.press(PALETTE_SHORTCUT);
    await page.waitForTimeout(250);
    await page.locator('#paletteInput').fill('settings');
    await page.waitForTimeout(250);
    assert.match(await page.locator('#paletteResults').innerText(), /Open settings/);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    assert.equal(
      await page.locator('#settingsDialog').evaluate((dialog) => dialog.open),
      true,
      'palette runs a command',
    );
    await page.keyboard.press('Escape');

    const firstBefore = await page
      .locator('#tiles .tile:not(.tile--add) .tile__title')
      .first()
      .textContent();
    await page.locator('#tiles .tile:not(.tile--add) .tile__main').first().focus();
    await page.keyboard.press('Alt+ArrowRight');
    await page.waitForTimeout(200);
    const firstAfter = await page
      .locator('#tiles .tile:not(.tile--add) .tile__title')
      .first()
      .textContent();
    assert.notEqual(firstBefore, firstAfter, 'Alt+Arrow reorders tiles');

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    assert.equal(await page.locator('#notes').inputValue(), 'A quiet test note.');
    assert.equal(
      await page.locator('.tile__title', { hasText: 'Research' }).count(),
      1,
      'state persists after reload',
    );

    await page.waitForTimeout(800);
    const workers = await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.length;
    });
    assert.ok(workers >= 1, 'service worker registers');

    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, {
      timeout: 8000,
    });
    await page.context().setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('#clock').count(), 1, 'app shell loads offline');
    assert.ok((await page.locator('#tiles .tile').count()) > 0, 'state loads offline');
    await page.context().setOffline(false);

    assert.deepEqual(errors, [], 'no application console errors');
    console.log('PATAB smoke test passed: links, folders, tasks, notes, theme, search,');
    console.log('palette, keyboard reordering, persistence, service worker and offline mode.');
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
