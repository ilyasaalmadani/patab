#!/usr/bin/env node
/**
 * Generate README screenshots and social images from the real app.
 * Requires Google Chrome and playwright-core:
 *   npm install
 *   npm run screenshots
 */

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createSeedState } from '../assets/core.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SHOTS = resolve(ROOT, 'docs/screenshots');
const DOCS = resolve(ROOT, 'docs');
const BASE_URL = process.env.PATAB_URL || 'http://127.0.0.1:4173';
const FIXED_TIME = '2026-10-19T09:41:00';
const WEATHER_AT = Date.parse(FIXED_TIME);

mkdirSync(SHOTS, { recursive: true });

function buildState(theme) {
  const state = createSeedState();
  state.settings.theme = theme;
  state.settings.accent = 'lime';
  state.settings.background = 'aurora';
  state.settings.weather = {
    enabled: true,
    lat: -6.2088,
    lon: 106.8456,
    label: 'Jakarta',
  };
  return state;
}

const weather = {
  at: WEATHER_AT,
  temp: 29,
  apparent: 32,
  code: 2,
  label: 'Jakarta',
};

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

async function newDashboardPage(browser, { theme, viewport, deviceScaleFactor = 1.5 }) {
  const page = await browser.newPage({ viewport, deviceScaleFactor });
  await page.clock.install({ time: new Date(FIXED_TIME) });
  await page.addInitScript(
    ([state, cachedWeather]) => {
      localStorage.setItem('patab:state:v1', JSON.stringify(state));
      localStorage.setItem('patab:weather:v1', JSON.stringify(cachedWeather));
    },
    [buildState(theme), weather],
  );
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  return page;
}

function socialHtml({ width, height, banner }) {
  const icon = readFileSync(resolve(ROOT, 'assets/icon.svg'));
  const iconData = `data:image/svg+xml;base64,${icon.toString('base64')}`;
  const tiles = [
    ['G', 'linear-gradient(145deg,#9aa7bd,#5f6b80)'],
    ['M', 'linear-gradient(145deg,#ff9b8f,#d94848)'],
    ['C', 'linear-gradient(145deg,#7fb0ff,#3d6ee8)'],
    ['F', 'linear-gradient(145deg,#ffa8d2,#d95296)'],
    ['Y', 'linear-gradient(145deg,#ff9b8f,#d94848)'],
    ['N', 'linear-gradient(145deg,#7fe7d3,#239c8c)'],
  ];
  const tileMarkup = tiles
    .map(
      ([letter, background]) =>
        `<span class="tile" style="background:${background}">${letter}</span>`,
    )
    .join('');
  const scale = banner ? 1 : 0.82;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
  body {
    display: grid;
    place-items: center;
    background: #07090e;
    color: #f2f5fa;
    font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Arial, sans-serif;
  }
  .stage {
    position: relative;
    width: ${width}px;
    height: ${height}px;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(60% 90% at 12% 0%, rgba(201,242,77,.2), transparent 60%),
      radial-gradient(55% 80% at 92% 18%, rgba(74,128,255,.18), transparent 62%),
      radial-gradient(60% 80% at 55% 120%, rgba(150,96,255,.16), transparent 60%),
      linear-gradient(180deg, #0b0f17, #07090e);
  }
  .stage::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
    background-size: 64px 64px;
    mask-image: radial-gradient(ellipse 75% 75% at 50% 45%, #000 10%, transparent 78%);
  }
  .stage::after {
    content: "";
    position: absolute;
    inset: 0;
    opacity: .05;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }
  .content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: ${banner ? 56 : 64}px;
    transform: scale(${scale});
  }
  .icon {
    width: ${banner ? 168 : 176}px;
    height: ${banner ? 168 : 176}px;
    border-radius: 38px;
    box-shadow: 0 40px 90px -28px rgba(0,0,0,.85), 0 0 80px rgba(201,242,77,.105);
  }
  .copy { display: flex; flex-direction: column; align-items: flex-start; }
  .kicker {
    margin-bottom: 8px;
    color: #c9f24d;
    font-size: ${banner ? 17 : 15}px;
    font-weight: 700;
    letter-spacing: .22em;
    text-transform: uppercase;
  }
  h1 {
    margin: 0;
    font-size: ${banner ? 112 : 104}px;
    font-weight: 650;
    letter-spacing: -.065em;
    line-height: .95;
  }
  .tagline {
    margin-top: ${banner ? 18 : 14}px;
    color: #c4ccda;
    font-size: ${banner ? 30 : 27}px;
    font-weight: 450;
    letter-spacing: -.025em;
  }
  .tags {
    display: flex;
    gap: 10px;
    margin-top: ${banner ? 30 : 26}px;
  }
  .tags span {
    padding: 7px 14px;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 999px;
    background: rgba(255,255,255,.055);
    color: #8d97a9;
    font-size: ${banner ? 15 : 14}px;
    letter-spacing: .02em;
  }
  .tiles {
    display: flex;
    gap: 14px;
    margin-top: ${banner ? 34 : 28}px;
  }
  .tile {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 15px;
    color: #fff;
    font-size: 19px;
    font-weight: 700;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.25), 0 12px 24px -12px rgba(0,0,0,.8);
  }
  .foot {
    position: absolute;
    left: ${banner ? 64 : 56}px;
    bottom: ${banner ? 42 : 34}px;
    z-index: 1;
    color: #6b7486;
    font-size: ${banner ? 16 : 14}px;
    letter-spacing: .04em;
  }
</style>
</head>
<body>
  <div class="stage">
    <div class="content">
      <img class="icon" src="${iconData}" alt="" />
      <div class="copy">
        <div class="kicker">Papan tab</div>
        <h1>patab</h1>
        <p class="tagline">Your new tab, reimagined.</p>
        <div class="tags">
          <span>local-first</span><span>no account</span><span>MIT</span>
        </div>
        <div class="tiles">${tileMarkup}</div>
      </div>
    </div>
    <div class="foot">Links · Notes · Tasks · Focus · Weather</div>
  </div>
</body>
</html>`;
}

async function renderSocial(browser, { name, width, height, banner }) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  await page.setContent(socialHtml({ width, height, banner }), { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(DOCS, name) });
  await page.close();
}

async function main() {
  const server = spawn(process.execPath, [resolve(ROOT, 'scripts/dev.mjs')], {
    cwd: ROOT,
    stdio: 'ignore',
    env: { ...process.env, PORT: '4173' },
  });

  try {
    await waitForServer(BASE_URL);

    const browser = await chromium.launch({ channel: 'chrome', headless: true });

    const dark = await newDashboardPage(browser, {
      theme: 'dark',
      viewport: { width: 1600, height: 1100 },
      deviceScaleFactor: 1.5,
    });
    await dark.screenshot({
      path: resolve(SHOTS, 'dashboard-dark.png'),
      fullPage: true,
    });

    await dark.keyboard.press('Meta+k');
    await dark.waitForTimeout(450);
    await dark.screenshot({
      path: resolve(SHOTS, 'palette.png'),
      fullPage: false,
    });
    await dark.keyboard.press('Escape');
    await dark.locator('[data-action="open-settings"]').first().click();
    await dark.waitForTimeout(450);
    await dark.screenshot({
      path: resolve(SHOTS, 'settings.png'),
      fullPage: false,
    });
    await dark.close();

    const light = await newDashboardPage(browser, {
      theme: 'light',
      viewport: { width: 1600, height: 1100 },
      deviceScaleFactor: 1.5,
    });
    await light.screenshot({
      path: resolve(SHOTS, 'dashboard-light.png'),
      fullPage: true,
    });
    await light.close();

    const mobile = await newDashboardPage(browser, {
      theme: 'dark',
      viewport: { width: 390, height: 1000 },
      deviceScaleFactor: 2,
    });
    await mobile.screenshot({
      path: resolve(SHOTS, 'mobile.png'),
      fullPage: false,
    });
    await mobile.close();

    await renderSocial(browser, {
      name: 'banner.png',
      width: 1600,
      height: 600,
      banner: true,
    });
    await renderSocial(browser, {
      name: 'og.png',
      width: 1280,
      height: 640,
      banner: false,
    });

    await browser.close();
    console.log('Screenshots written to docs/ and docs/screenshots/.');
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
