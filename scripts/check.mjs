#!/usr/bin/env node
/**
 * Static integrity check. No dependencies, safe for CI.
 * Verifies local references, manifest assets, screenshots, version consistency
 * and the license.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const failures = [];
const checked = new Set();

function fail(message) {
  failures.push(message);
}

function checkFile(relative) {
  if (checked.has(relative)) return;
  checked.add(relative);
  if (!existsSync(join(ROOT, relative))) fail(`Missing file: ${relative}`);
}

function isLocal(value) {
  return (
    value &&
    !value.startsWith('#') &&
    !value.startsWith('http://') &&
    !value.startsWith('https://') &&
    !value.startsWith('mailto:') &&
    !value.startsWith('data:')
  );
}

function checkReference(value) {
  if (!isLocal(value)) return;
  const clean = value.split(/[?#]/)[0].trim();
  if (!clean) return;
  if (clean.endsWith('/')) {
    checkFile(join(clean, 'index.html'));
    return;
  }
  checkFile(clean);
}

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
for (const match of html.matchAll(/\b(?:src|href|srcset)="([^"]+)"/g)) {
  match[1].split(',').forEach((part) => checkReference(part.trim().split(/\s+/)[0]));
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
for (const icon of manifest.icons || []) checkFile(icon.src);
for (const screenshot of manifest.screenshots || []) checkFile(screenshot.src);

const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
for (const match of sw.matchAll(/'(\\.\/[^']+)'/g)) {
  const path = match[1].replace(/^\.\//, '');
  if (path === '') checkFile('index.html');
  else checkFile(path);
}

for (const readme of ['README.md', 'README.id.md']) {
  if (!existsSync(join(ROOT, readme))) {
    fail(`Missing documentation: ${readme}`);
    continue;
  }
  const markdown = readFileSync(join(ROOT, readme), 'utf8');
  for (const match of markdown.matchAll(/\b(?:src|href|srcset)="([^"]+)"/g)) {
    match[1].split(',').forEach((part) => checkReference(part.trim().split(/\s+/)[0]));
  }
  for (const match of markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
    checkReference(match[1]);
  }
}

const license = readFileSync(join(ROOT, 'LICENSE'), 'utf8');
if (!license.includes('MIT License')) fail('LICENSE is not MIT.');
if (!/Copyright \(c\) 2026 Ilyas Akbar Almadani/.test(license)) {
  fail('LICENSE is missing the copyright line.');
}

const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const core = readFileSync(join(ROOT, 'assets/core.js'), 'utf8');
const appVersion = core.match(/APP_VERSION = '([^']+)'/)?.[1];
if (appVersion !== packageJson.version) {
  fail(`App version ${appVersion || 'missing'} does not match package.json ${packageJson.version}.`);
}
if (!sw.includes(`patab-v${packageJson.version}`)) {
  fail('Service worker cache version does not match package.json.');
}

const assets = readdirSync(join(ROOT, 'assets'));
for (const name of assets) {
  const full = join(ROOT, 'assets', name);
  if (!statSync(full).isFile()) continue;
  if (extname(name) === '.js') {
    const source = readFileSync(full, 'utf8');
    if (/\bTODO\b|\bFIXME\b/.test(source)) fail(`Unfinished marker in assets/${name}`);
  }
}

if (failures.length) {
  console.error(`PATAB check failed (${failures.length}):`);
  failures.forEach((message) => console.error(` - ${message}`));
  process.exit(1);
}

console.log(`PATAB check passed — ${checked.size} local references verified.`);
