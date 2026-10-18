import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSeedState,
  fuzzyScore,
  normalizeState,
  normalizeUrl,
  parseImport,
  parseQuery,
  searchLinks,
  webUrl,
  formatClock,
  moveItem,
  countLinks,
  activeBoard,
} from '../assets/core.js';

test('seed state is valid and has usable content', () => {
  const state = createSeedState();
  assert.equal(state.boards.length, 2);
  assert.ok(countLinks(state) >= 12);
  assert.ok(state.boards.every((board) => board.links.length > 0));
  assert.ok(activeBoard(state));
});

test('normalizeUrl accepts bare hosts and rejects dangerous schemes', () => {
  assert.equal(normalizeUrl('github.com'), 'https://github.com/');
  assert.equal(normalizeUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(normalizeUrl('javascript:alert(1)'), '');
  assert.equal(normalizeUrl('data:text/html,hi'), '');
  assert.equal(normalizeUrl('   '), '');
  assert.equal(normalizeUrl(42), '');
});

test('normalizeState repairs corrupt input and keeps the active board honest', () => {
  const fallback = normalizeState(null);
  assert.ok(fallback.boards.length >= 1);

  const state = normalizeState({
    activeBoardId: 'missing',
    boards: [
      {
        id: 'board_1',
        name: '  My   board ',
        links: [
          { type: 'link', title: 'Good', url: 'example.com', tone: 'nope' },
          { type: 'link', title: 'Bad', url: 'javascript:alert(1)' },
          { type: 'folder', title: 'Tools', items: [{ title: 'MDN', url: 'developer.mozilla.org' }] },
        ],
        notes: 'hello',
        tasks: [{ text: 'Do it', done: true }, { text: '' }],
      },
    ],
    settings: { theme: 'neon', accent: 'nope', use24h: 'yes' },
  });

  assert.equal(state.boards.length, 1);
  assert.equal(state.boards[0].name, 'My board');
  assert.equal(state.boards[0].links.length, 2);
  assert.equal(state.boards[0].links[0].url, 'https://example.com/');
  assert.ok(state.boards[0].links[0].tone);
  assert.equal(state.boards[0].tasks.length, 1);
  assert.equal(state.activeBoardId, state.boards[0].id);
  assert.equal(state.settings.theme, 'system');
  assert.equal(state.settings.accent, 'lime');
  assert.equal(state.settings.use24h, true);
});

test('parseImport rejects junk and accepts a backup', () => {
  assert.throws(() => parseImport('not json'), /valid JSON/);
  assert.throws(() => parseImport('{"hello":1}'), /PATAB backup/);
  const backup = JSON.stringify(createSeedState());
  const parsed = parseImport(backup);
  assert.equal(parsed.boards.length, 2);
});

test('fuzzyScore ranks prefix and exact matches above scattered ones', () => {
  assert.ok(fuzzyScore('git', 'GitHub') > fuzzyScore('git', 'Digital Garden'));
  assert.ok(fuzzyScore('github', 'GitHub') > fuzzyScore('gh', 'GitHub'));
  assert.equal(fuzzyScore('zzz', 'GitHub'), 0);
  assert.ok(fuzzyScore('mdn', 'MDN Web Docs') > 0);
});

test('searchLinks finds nested folder items across boards', () => {
  const state = createSeedState();
  const results = searchLinks(state, 'linear');
  assert.ok(results.some((result) => result.title === 'Linear'));
  const linear = results.find((result) => result.title === 'Linear');
  assert.equal(linear.folderName, 'Studio');

  const folder = searchLinks(state, 'studio');
  assert.ok(folder.some((result) => result.kind === 'folder'));
});

test('parseQuery understands bangs and plain searches', () => {
  assert.deepEqual(parseQuery('!g cats'), { type: 'bang', bang: 'g', term: 'cats' });
  assert.deepEqual(parseQuery('!yt'), { type: 'bang', bang: 'yt', term: '' });
  assert.deepEqual(parseQuery('  quiet web '), { type: 'text', term: 'quiet web' });
  assert.deepEqual(parseQuery('!nope x'), { type: 'text', term: '!nope x' });
  assert.match(webUrl('g', 'cats & dogs'), /cats%20%26%20dogs/);
  assert.match(webUrl('gh', 'patab'), /github\.com\/search/);
});

test('formatClock respects 12/24 hour settings', () => {
  const morning = new Date(2026, 9, 19, 9, 5);
  assert.equal(formatClock(morning, true), '09:05');
  assert.equal(formatClock(morning, false), '9:05');
  const midnight = new Date(2026, 9, 19, 0, 7);
  assert.equal(formatClock(midnight, false), '12:07');
});

test('moveItem reorders without mutating the source', () => {
  const source = ['a', 'b', 'c'];
  assert.deepEqual(moveItem(source, 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(source, ['a', 'b', 'c']);
  assert.equal(moveItem(source, 5, 0), source);
});

test('unset weather stays unset after normalization', () => {
  const state = createSeedState();
  state.settings.weather = { enabled: false, lat: null, lon: null, label: '' };
  const normalized = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(normalized.settings.weather.lat, null);
  assert.equal(normalized.settings.weather.lon, null);
  assert.equal(normalized.settings.weather.enabled, false);
});

test('coordinates at zero are valid when explicitly set', () => {
  const state = createSeedState();
  state.settings.weather = { enabled: true, lat: 0, lon: 0, label: 'Null Island' };
  const normalized = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(normalized.settings.weather.lat, 0);
  assert.equal(normalized.settings.weather.lon, 0);
  assert.equal(normalized.settings.weather.enabled, true);
});
