/**
 * PATAB — application shell.
 *
 * Vanilla ES modules, no framework, no build step. State lives in localStorage
 * and every render path keeps user content out of innerHTML.
 */

import {
  APP_VERSION,
  STORAGE_KEY,
  WEATHER_KEY,
  ACCENTS,
  BANGS,
  TONES,
  activeBoard,
  countLinks,
  countTasks,
  createSeedState,
  dateLabel,
  displayUrl,
  faviconUrl,
  formatBytes,
  formatClock,
  fuzzyScore,
  greetingFor,
  hostOf,
  moveItem,
  normalizeState,
  normalizeUrl,
  parseImport,
  parseQuery,
  searchLinks,
  toneFor,
  toneGradient,
  uid,
  webUrl,
} from './core.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const modLabel = isMac ? '⌘' : 'Ctrl';
const FOCUS_PRESETS = [25, 50, 15];
const WEATHER_TTL = 30 * 60 * 1000;
const RING_LENGTH = 2 * Math.PI * 52;

const COMMANDS = [
  {
    id: 'add-link',
    title: 'Add a link',
    subtitle: 'New tile on this board',
    icon: 'i-plus',
    keywords: 'new tile shortcut create',
  },
  {
    id: 'add-folder',
    title: 'Add a folder',
    subtitle: 'Group related links together',
    icon: 'i-folder',
    keywords: 'group collection',
  },
  {
    id: 'add-board',
    title: 'New board',
    subtitle: 'A fresh page for a different context',
    icon: 'i-grid',
    keywords: 'workspace page',
  },
  {
    id: 'open-settings',
    title: 'Open settings',
    subtitle: 'Theme, weather, backup and more',
    icon: 'i-settings',
    keywords: 'preferences theme accent weather',
  },
  {
    id: 'toggle-theme',
    title: 'Toggle theme',
    subtitle: 'Switch between dark and light',
    icon: 'i-moon',
    keywords: 'dark light appearance',
  },
  {
    id: 'open-shortcuts',
    title: 'Keyboard shortcuts',
    subtitle: 'Every shortcut in one place',
    icon: 'i-keyboard',
    keywords: 'help keys',
  },
  {
    id: 'export',
    title: 'Export backup',
    subtitle: 'Download a JSON copy of everything',
    icon: 'i-download',
    keywords: 'save backup download',
  },
  {
    id: 'import',
    title: 'Import backup',
    subtitle: 'Restore from a PATAB JSON file',
    icon: 'i-upload',
    keywords: 'restore load',
  },
];

const SHORTCUTS = [
  ['Open command palette', [modLabel, 'K']],
  ['Focus the search bar', ['/']],
  ['Add a link', ['N']],
  ['Show this panel', ['?']],
  ['Close a dialog', ['Esc']],
  ['Reorder a focused tile', ['Alt', '←/→']],
  ['Open the focused tile', ['Enter']],
];

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { state: normalizeState(JSON.parse(raw)), fresh: false };
  } catch {
    /* A corrupt payload should never block the first paint. */
  }
  return { state: createSeedState(), fresh: true };
}

const loaded = loadState();
let state = loaded.state;
let saveTimer = null;
let noteSaveTimer = null;
let toastTimer = null;
let weatherCache = readWeatherCache();
let weatherLoading = false;
let weatherError = false;
let deferredInstall = null;
let currentFolderId = null;
let editingLinkId = null;
let editingFolderId = null;
let editingBoardId = null;
let draftTone = 'slate';
let searchItems = [];
let searchActive = 0;
let paletteItems = [];
let paletteActive = 0;
let lastTitle = '';

const focus = {
  presetIndex: 0,
  duration: FOCUS_PRESETS[0] * 60,
  remaining: FOCUS_PRESETS[0] * 60,
  running: false,
  endsAt: 0,
  timer: null,
};

/* ------------------------------------------------------------------ */
/* Tiny DOM helpers                                                    */
/* ------------------------------------------------------------------ */

function svgIcon(name, className = 'icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${name}`);
  svg.append(use);
  return svg;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function initialOf(value) {
  const first = Array.from(String(value || '').trim())[0];
  return (first || '?').toUpperCase();
}

function showDialog(dialog) {
  if (!dialog || dialog.open) return;
  dialog.showModal();
}

function closeAllDialogs() {
  $$('dialog[open]').forEach((dialog) => dialog.close());
}

function closeSearch() {
  const pop = $('#searchResults');
  const input = $('#searchInput');
  if (!pop) return;
  pop.hidden = true;
  pop.replaceChildren();
  input?.setAttribute('aria-expanded', 'false');
  input?.removeAttribute('aria-activedescendant');
  searchActive = 0;
}

function toast(message) {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.hidden = true;
  void node.offsetWidth;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.hidden = true;
  }, 3400);
}

function withViewTransition(update) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (typeof document.startViewTransition === 'function' && !reduced) {
    document.startViewTransition(update);
  } else {
    update();
  }
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

function storageBytes() {
  try {
    return new TextEncoder().encode(JSON.stringify(state)).length;
  } catch {
    return 0;
  }
}

function setSaveState(text) {
  const node = $('#saveState');
  if (node) node.textContent = text;
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSaveState('All changes saved');
    updateStorageMeta();
  } catch {
    setSaveState('Storage blocked');
    toast('Could not save. Your browser storage may be full.');
  }
}

function scheduleSave() {
  setSaveState('Saving…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 450);
}

function updateStorageMeta() {
  const bytes = storageBytes();
  const size = formatBytes(bytes);
  const statSize = $('#statSize');
  if (statSize) statSize.textContent = size;
  const storageMeta = $('#storageMeta');
  if (storageMeta) {
    storageMeta.textContent = `${size} stored on this device. Export a backup to keep it safe.`;
  }
}

/* ------------------------------------------------------------------ */
/* Appearance                                                          */
/* ------------------------------------------------------------------ */

function resolvedTheme() {
  if (state.settings.theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return state.settings.theme;
}

function applyAppearance() {
  const root = document.documentElement;
  const theme = resolvedTheme();
  root.dataset.theme = theme;
  root.dataset.accent = state.settings.accent;
  root.dataset.bg = state.settings.background;

  const toggle = $('#themeToggle');
  if (toggle) {
    toggle.setAttribute(
      'aria-label',
      theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
    );
  }
}

function setTheme(theme) {
  state.settings.theme = theme;
  persist();
  withViewTransition(applyAppearance);
  renderSettings(true);
}

function toggleTheme() {
  setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark');
}

/* ------------------------------------------------------------------ */
/* Boards                                                              */
/* ------------------------------------------------------------------ */

function renderBoards() {
  const nav = $('#boards');
  if (!nav) return;
  nav.replaceChildren();

  for (const board of state.boards) {
    const tab = element('button', 'board-tab');
    tab.type = 'button';
    tab.dataset.action = 'switch-board';
    tab.dataset.boardId = board.id;
    tab.setAttribute('aria-current', String(board.id === state.activeBoardId));
    tab.title = board.name;
    const symbol = element('span', 'board-tab__symbol', board.symbol);
    symbol.setAttribute('aria-hidden', 'true');
    tab.append(symbol, document.createTextNode(board.name));
    nav.append(tab);
  }

  const add = element('button', 'board-tab board-tab--add');
  add.type = 'button';
  add.dataset.action = 'add-board';
  add.setAttribute('aria-label', 'Create a board');
  add.title = 'New board';
  add.append(svgIcon('i-plus'));
  nav.append(add);
}

function switchBoard(boardId) {
  if (boardId === state.activeBoardId) return;
  if (!state.boards.some((board) => board.id === boardId)) return;
  withViewTransition(() => {
    state.activeBoardId = boardId;
    persist();
    renderBoards();
    renderTiles();
    renderNotes();
    renderTasks();
    renderStats();
  });
}

/* ------------------------------------------------------------------ */
/* Tiles                                                               */
/* ------------------------------------------------------------------ */

function addFavicon(wrapper, url, letterNode) {
  if (!state.settings.siteIcons) return;
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.addEventListener('load', () => {
    if (img.naturalWidth <= 1) {
      img.remove();
      return;
    }
    letterNode?.remove();
  });
  img.addEventListener('error', () => img.remove());
  img.src = faviconUrl(url);
  wrapper.append(img);
}

function buildTileIcon(tile) {
  const wrapper = element('span', 'tile__icon tile__icon--tone');
  wrapper.style.background = toneGradient(tile.tone || toneFor(tile.title));

  if (tile.type === 'folder') {
    const grid = element('span', 'tile__mini-grid');
    tile.items.slice(0, 4).forEach((item) => {
      const mini = element('span', 'tile__mini', initialOf(item.title));
      addFavicon(mini, item.url, mini.firstChild);
      grid.append(mini);
    });
    wrapper.append(grid);
    return wrapper;
  }

  const letter = element('span', 'tile__monogram', initialOf(tile.title));
  wrapper.append(letter);
  addFavicon(wrapper, tile.url, letter);
  return wrapper;
}

function buildTile(tile) {
  const node = element('div', 'tile');
  node.dataset.id = tile.id;
  node.draggable = true;

  const main = document.createElement(tile.type === 'folder' ? 'button' : 'a');
  main.className = 'tile__main';

  if (tile.type === 'folder') {
    main.type = 'button';
    main.dataset.action = 'open-folder';
    main.dataset.id = tile.id;
    main.setAttribute('aria-label', `Open folder ${tile.title}`);
  } else {
    main.href = tile.url;
    main.target = '_blank';
    main.rel = 'noopener noreferrer';
    main.draggable = false;
    main.dataset.track = 'true';
    main.dataset.title = tile.title;
  }

  main.append(buildTileIcon(tile), element('span', 'tile__title', tile.title));

  const menu = element('button', 'tile__menu');
  menu.type = 'button';
  menu.dataset.action = 'edit-tile';
  menu.dataset.id = tile.id;
  menu.setAttribute('aria-label', `Edit ${tile.title}`);
  menu.title = tile.type === 'folder' ? 'Edit folder' : 'Edit link';
  menu.append(svgIcon('i-edit'));

  node.append(main, menu);
  return node;
}

function buildAddTile() {
  const node = element('div', 'tile tile--add');
  const button = element('button', 'tile__main');
  button.type = 'button';
  button.dataset.action = 'add-link';
  const icon = element('span', 'tile__icon');
  icon.append(svgIcon('i-plus'));
  button.append(icon, element('span', 'tile__title', 'Add tile'));
  node.append(button);
  return node;
}

function renderTiles() {
  const board = activeBoard(state);
  const container = $('#tiles');
  if (!board || !container) return;
  container.replaceChildren();
  board.links.forEach((tile) => container.append(buildTile(tile)));
  container.append(buildAddTile());

  const total = board.links.reduce(
    (count, tile) => count + (tile.type === 'folder' ? tile.items.length : 1),
    0,
  );
  const meta = $('#linksMeta');
  if (meta) meta.textContent = `${board.links.length} tiles · drag to rearrange`;
  const count = $('#linkCount');
  if (count) count.textContent = `${total} shortcut${total === 1 ? '' : 's'}`;
}

function findTile(id) {
  return activeBoard(state)?.links.find((tile) => tile.id === id) || null;
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

function commandItem(id, group) {
  const command = COMMANDS.find((item) => item.id === id);
  return command ? { ...command, kind: 'command', group } : null;
}

function matchCommands(query) {
  const q = query.trim();
  if (!q) return COMMANDS.slice();
  return COMMANDS.map((command) => {
    const score = Math.max(
      fuzzyScore(q, command.title) * 1.2,
      fuzzyScore(q, command.keywords) * 0.75,
      fuzzyScore(q, command.subtitle) * 0.35,
    );
    return { ...command, score };
  })
    .filter((command) => command.score > 0)
    .sort((a, b) => b.score - a.score);
}

function buildSearchItems(rawQuery, forPalette = false) {
  const query = rawQuery.trim();
  const items = [];

  if (!query) {
    state.meta.recent.slice(0, 4).forEach((entry) => {
      items.push({
        kind: 'recent',
        title: entry.title,
        url: entry.url,
        tone: toneFor(entry.url),
        group: 'Recent',
      });
    });
    const ids = forPalette
      ? COMMANDS.map((command) => command.id)
      : ['add-link', 'add-board', 'open-settings'];
    ids.forEach((id) => {
      const item = commandItem(id, 'Actions');
      if (item) items.push(item);
    });
    return items;
  }

  const parsed = parseQuery(query);
  if (parsed.type === 'bang') {
    const bang = BANGS[parsed.bang];
    items.push({
      kind: 'web',
      title: parsed.term
        ? `Search ${bang.name} for “${parsed.term.slice(0, 48)}”`
        : `Open ${bang.name}`,
      subtitle: 'Press Enter',
      bang: parsed.bang,
      term: parsed.term,
      group: 'Web',
      icon: 'i-globe',
    });
    return items;
  }

  matchCommands(query)
    .slice(0, 3)
    .forEach((command) => {
      items.push({ ...command, kind: 'command', group: 'Actions' });
    });

  const links = searchLinks(state, query, { limit: 7 });
  links
    .filter((result) => result.kind === 'folder')
    .forEach((result) => items.push({ ...result, group: 'Folders' }));
  links
    .filter((result) => result.kind === 'link')
    .forEach((result) => items.push({ ...result, group: 'Jump to' }));

  items.push({
    kind: 'web',
    title: `Search the web for “${query.slice(0, 48)}”`,
    subtitle: 'DuckDuckGo',
    bang: 'ddg',
    term: query,
    group: 'Web',
    icon: 'i-globe',
  });

  return items.slice(0, 12);
}

function buildSearchIcon(item) {
  const icon = element('span', 'search-item__icon');

  if (item.kind === 'link' || item.kind === 'recent') {
    icon.classList.add('search-item__icon--tone');
    icon.style.background = toneGradient(item.tone || toneFor(item.url || item.title));
    const letter = element('span', '', initialOf(item.title));
    icon.append(letter);
    addFavicon(icon, item.url, letter);
    return icon;
  }

  if (item.kind === 'folder') icon.append(svgIcon('i-folder'));
  else if (item.kind === 'web') icon.append(svgIcon('i-globe'));
  else icon.append(svgIcon(item.icon || 'i-command'));

  return icon;
}

function renderResultList(container, items, active, prefix) {
  container.replaceChildren();
  if (!items.length) {
    container.append(element('div', 'search-empty', 'No matches. Try another word.'));
    return;
  }

  let currentGroup = '';
  items.forEach((item, index) => {
    if (item.group && item.group !== currentGroup) {
      currentGroup = item.group;
      container.append(element('div', 'search-group', currentGroup));
    }

    const button = element('button', 'search-item');
    button.type = 'button';
    button.dataset.index = String(index);
    button.id = `${prefix}-opt-${index}`;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(index === active));

    const text = element('span', 'search-item__text');
    text.append(element('span', 'search-item__title', item.title));
    const subtitle =
      item.kind === 'link'
        ? `${item.boardName}${item.folderName ? ` · ${item.folderName}` : ''}`
        : item.kind === 'folder'
          ? `Folder · ${item.boardName}`
          : item.subtitle || 'Press Enter';
    text.append(element('span', 'search-item__sub', subtitle));

    const hint = element('span', 'search-item__hint', '↵');
    button.append(buildSearchIcon(item), text, hint);
    container.append(button);
  });
}

function renderSearch() {
  const input = $('#searchInput');
  const pop = $('#searchResults');
  if (!input || !pop) return;

  searchItems = buildSearchItems(input.value);
  searchActive = Math.min(searchActive, Math.max(0, searchItems.length - 1));
  renderResultList(pop, searchItems, searchActive, 'search');
  pop.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  const active = $(`#search-opt-${searchActive}`, pop);
  if (active) input.setAttribute('aria-activedescendant', active.id);
  active?.scrollIntoView({ block: 'nearest' });
}

function setSearchActive(index) {
  if (!searchItems.length) return;
  searchActive = (index + searchItems.length) % searchItems.length;
  const pop = $('#searchResults');
  $$('.search-item', pop).forEach((node, itemIndex) => {
    node.setAttribute('aria-selected', String(itemIndex === searchActive));
  });
  const active = $(`#search-opt-${searchActive}`, pop);
  if (active) {
    $('#searchInput')?.setAttribute('aria-activedescendant', active.id);
    active.scrollIntoView({ block: 'nearest' });
  }
}

function openExternal(url) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function recordRecent(item) {
  if (!item?.url) return;
  const recent = state.meta.recent.filter((entry) => entry.url !== item.url);
  recent.unshift({ title: item.title || hostOf(item.url), url: item.url });
  state.meta.recent = recent.slice(0, 8);
  scheduleSave();
}

function executeItem(item) {
  if (!item) return;
  closeSearch();
  closePalette();

  if (item.kind === 'command') {
    runCommand(item.id);
    return;
  }

  if (item.kind === 'folder') {
    openFolder(item.id, item.boardId);
    return;
  }

  if (item.kind === 'web') {
    openExternal(webUrl(item.bang, item.term));
    return;
  }

  if (item.url) {
    recordRecent(item);
    openExternal(item.url);
  }
}

/* ------------------------------------------------------------------ */
/* Command palette                                                     */
/* ------------------------------------------------------------------ */

function renderPalette() {
  const input = $('#paletteInput');
  const results = $('#paletteResults');
  if (!input || !results) return;
  paletteItems = buildSearchItems(input.value, true);
  paletteActive = Math.min(paletteActive, Math.max(0, paletteItems.length - 1));
  renderResultList(results, paletteItems, paletteActive, 'palette');
  input.setAttribute('aria-activedescendant', `palette-opt-${paletteActive}`);
  $(`#palette-opt-${paletteActive}`, results)?.scrollIntoView({ block: 'nearest' });
}

function setPaletteActive(index) {
  if (!paletteItems.length) return;
  paletteActive = (index + paletteItems.length) % paletteItems.length;
  $$('.search-item', $('#paletteResults')).forEach((node, itemIndex) => {
    node.setAttribute('aria-selected', String(itemIndex === paletteActive));
  });
  const active = $(`#palette-opt-${paletteActive}`);
  if (active) {
    $('#paletteInput')?.setAttribute('aria-activedescendant', active.id);
    active.scrollIntoView({ block: 'nearest' });
  }
}

function openPalette() {
  closeAllDialogs();
  const dialog = $('#paletteDialog');
  const input = $('#paletteInput');
  if (!dialog || !input) return;
  input.value = '';
  paletteActive = 0;
  showDialog(dialog);
  renderPalette();
  requestAnimationFrame(() => input.focus());
}

function closePalette() {
  const dialog = $('#paletteDialog');
  if (dialog?.open) dialog.close();
}

/* ------------------------------------------------------------------ */
/* Folders                                                             */
/* ------------------------------------------------------------------ */

function folderIcon(item, className) {
  const wrapper = element('span', className);
  wrapper.style.background = toneGradient(item.tone || toneFor(item.url));
  const letter = element('span', '', initialOf(item.title));
  wrapper.append(letter);
  addFavicon(wrapper, item.url, letter);
  return wrapper;
}

function renderFolderView(folder) {
  const title = $('#folderViewTitle');
  const list = $('#folderList');
  if (!title || !list) return;
  title.textContent = folder.title;
  list.replaceChildren();

  if (!folder.items.length) {
    list.append(element('div', 'search-empty', 'This folder is empty.'));
    return;
  }

  folder.items.forEach((item) => {
    const anchor = document.createElement('a');
    anchor.className = 'folder-item';
    anchor.href = item.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.dataset.track = 'true';
    anchor.dataset.title = item.title;

    const text = element('span', 'folder-item__text');
    text.append(
      element('span', 'folder-item__title', item.title),
      element('span', 'folder-item__sub', displayUrl(item.url)),
    );

    const open = element('span', 'folder-item__open');
    open.append(svgIcon('i-external'));

    anchor.append(folderIcon(item, 'folder-item__icon'), text, open);
    list.append(anchor);
  });
}

function openFolder(folderId, boardId = state.activeBoardId) {
  if (boardId !== state.activeBoardId) {
    state.activeBoardId = boardId;
    persist();
    renderBoards();
    renderTiles();
    renderNotes();
    renderTasks();
    renderStats();
  }

  const folder = activeBoard(state)?.links.find(
    (tile) => tile.id === folderId && tile.type === 'folder',
  );
  if (!folder) {
    toast('That folder is no longer here.');
    return;
  }

  currentFolderId = folderId;
  renderFolderView(folder);
  closeAllDialogs();
  showDialog($('#folderViewDialog'));
}

function renderFolderRows(folder) {
  const container = $('#folderRows');
  if (!container) return;
  container.replaceChildren();
  const items = folder?.items?.length ? folder.items : [null];
  items.forEach((item) => addFolderRow(item));
}

function addFolderRow(item = null) {
  const container = $('#folderRows');
  if (!container) return;
  const row = element('div', 'folder-row');
  row.dataset.id = item?.id || '';

  const title = document.createElement('input');
  title.type = 'text';
  title.maxLength = 40;
  title.placeholder = 'Title';
  title.value = item?.title || '';
  title.setAttribute('aria-label', 'Folder link title');

  const url = document.createElement('input');
  url.type = 'text';
  url.inputMode = 'url';
  url.placeholder = 'example.com';
  url.value = item?.url || '';
  url.spellcheck = false;
  url.setAttribute('aria-label', 'Folder link URL');

  const remove = element('button', '');
  remove.type = 'button';
  remove.dataset.action = 'remove-folder-row';
  remove.setAttribute('aria-label', 'Remove this row');
  remove.append(svgIcon('i-close'));

  row.append(title, url, remove);
  container.append(row);
  return { row, title, url };
}

function collectFolderItems() {
  const rows = $$('.folder-row', $('#folderRows'));
  const items = [];
  let error = '';

  for (const row of rows) {
    const titleInput = $('input[aria-label="Folder link title"]', row);
    const urlInput = $('input[aria-label="Folder link URL"]', row);
    const title = titleInput?.value.trim() || '';
    const rawUrl = urlInput?.value.trim() || '';
    if (!title && !rawUrl) continue;

    const url = normalizeUrl(rawUrl);
    if (!url) {
      error = `Check the URL${title ? ` for “${title}”` : ''}.`;
      break;
    }

    items.push({
      id: row.dataset.id || uid('link'),
      type: 'link',
      title: title || hostOf(url),
      url,
      tone: toneFor(url),
    });
  }

  if (error) return { items: [], error };
  if (!items.length) return { items: [], error: 'Add at least one valid link.' };
  return { items, error: '' };
}

function openFolderDialog(folderId = null) {
  closeAllDialogs();
  const folder = folderId ? findTile(folderId) : null;
  if (folderId && folder?.type !== 'folder') return;
  editingFolderId = folder?.id || null;

  $('#folderDialogTitle').textContent = folder ? 'Edit folder' : 'New folder';
  $('#folderTitle').value = folder?.title || '';
  $('#folderError').hidden = true;
  $('#folderDelete').hidden = !folder;
  renderFolderRows(folder);
  showDialog($('#folderDialog'));
  requestAnimationFrame(() => $('#folderTitle').focus());
}

/* ------------------------------------------------------------------ */
/* Link dialog                                                         */
/* ------------------------------------------------------------------ */

function renderToneSwatches() {
  const container = $('#linkTones');
  if (!container) return;
  container.replaceChildren();
  TONES.forEach((tone) => {
    const button = element('button', 'swatch');
    button.type = 'button';
    button.dataset.action = 'pick-tone';
    button.dataset.tone = tone;
    button.style.setProperty('--swatch-color', toneGradient(tone));
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(tone === draftTone));
    button.setAttribute('aria-label', tone);
    button.title = tone[0].toUpperCase() + tone.slice(1);
    container.append(button);
  });
}

function openLinkDialog(linkId = null) {
  const tile = linkId ? findTile(linkId) : null;
  if (linkId && tile?.type === 'folder') {
    openFolderDialog(linkId);
    return;
  }

  closeAllDialogs();
  editingLinkId = tile?.id || null;
  draftTone = tile?.tone || toneFor(tile?.url || 'patab');
  $('#linkDialogTitle').textContent = tile ? 'Edit link' : 'New link';
  $('#linkTitle').value = tile?.title || '';
  $('#linkUrl').value = tile?.url || '';
  $('#linkError').hidden = true;
  $('#linkDelete').hidden = !tile;
  renderToneSwatches();
  showDialog($('#linkDialog'));
  requestAnimationFrame(() => {
    if (tile) $('#linkTitle').focus();
    else $('#linkUrl').focus();
  });
}

/* ------------------------------------------------------------------ */
/* Board dialog                                                        */
/* ------------------------------------------------------------------ */

function openBoardDialog(boardId = null) {
  closeAllDialogs();
  const board = boardId ? state.boards.find((item) => item.id === boardId) : null;
  editingBoardId = board?.id || null;
  $('#boardDialogTitle').textContent = board ? 'Edit board' : 'New board';
  $('#boardName').value = board?.name || '';
  $('#boardSymbol').value = board?.symbol || '';
  $('#boardDelete').hidden = !board || state.boards.length <= 1;
  showDialog($('#boardDialog'));
  requestAnimationFrame(() => $('#boardName').focus());
}

/* ------------------------------------------------------------------ */
/* Notes                                                               */
/* ------------------------------------------------------------------ */

function wordCount(text) {
  const value = String(text || '').trim();
  return value ? value.split(/\s+/).length : 0;
}

function updateNoteMeta() {
  const board = activeBoard(state);
  const meta = $('#noteMeta');
  if (!board || !meta) return;
  const text = board.notes || '';
  meta.textContent = `${wordCount(text)} words · ${text.length} chars`;
}

function renderNotes() {
  const board = activeBoard(state);
  const notes = $('#notes');
  if (!board || !notes) return;
  notes.value = board.notes;
  updateNoteMeta();
  const status = $('#noteStatus');
  if (status) status.textContent = 'Saved';
}

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

function renderTasks() {
  const board = activeBoard(state);
  const list = $('#tasks');
  if (!board || !list) return;
  list.replaceChildren();

  const { total, done } = countTasks(state, board.id);

  if (!total) {
    list.append(
      element('li', 'tasks__empty', 'A quiet list. Add the one thing that matters.'),
    );
  } else {
    board.tasks.forEach((task) => {
      const row = element('li', 'task');
      row.dataset.id = task.id;
      row.dataset.done = String(task.done);

      const check = element('button', 'task__check');
      check.type = 'button';
      check.dataset.action = 'toggle-task';
      check.dataset.id = task.id;
      check.setAttribute('role', 'checkbox');
      check.setAttribute('aria-checked', String(task.done));
      check.setAttribute('aria-label', task.done ? `Mark “${task.text}” as open` : `Complete “${task.text}”`);
      check.append(svgIcon('i-check'));

      const text = element('span', 'task__text', task.text);

      const remove = element('button', 'task__delete');
      remove.type = 'button';
      remove.dataset.action = 'delete-task';
      remove.dataset.id = task.id;
      remove.setAttribute('aria-label', `Delete “${task.text}”`);
      remove.append(svgIcon('i-close'));

      row.append(check, text, remove);
      list.append(row);
    });
  }

  const bar = $('#taskBar');
  if (bar) bar.style.width = total ? `${(done / total) * 100}%` : '0%';
  const meta = $('#taskMeta');
  if (meta) meta.textContent = total ? `${done} of ${total} done` : 'Nothing yet';
  renderStats();
}

/* ------------------------------------------------------------------ */
/* Focus timer                                                         */
/* ------------------------------------------------------------------ */

function formatDuration(seconds) {
  const safe = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function renderFocus() {
  const time = $('#focusTime');
  if (!time) return;
  time.textContent = formatDuration(focus.remaining);

  const ring = $('#focusRing');
  if (ring) {
    const progress = focus.duration ? focus.remaining / focus.duration : 0;
    ring.style.strokeDasharray = String(RING_LENGTH);
    ring.style.strokeDashoffset = String(RING_LENGTH * (1 - progress));
  }

  const preset = $('#focusPreset');
  if (preset) preset.textContent = `${focus.duration / 60} min`;

  const toggle = $('#focusToggle');
  if (toggle) {
    toggle.replaceChildren(
      svgIcon(focus.running ? 'i-pause' : 'i-play'),
      document.createTextNode(focus.running ? 'Pause' : 'Start'),
    );
  }

  const panel = $('.panel--focus');
  if (panel) panel.classList.toggle('is-running', focus.running);

  const hint = $('#focusHint');
  if (hint) {
    if (focus.running) hint.textContent = 'Stay with it. Everything else can wait.';
    else if (focus.remaining < focus.duration && focus.remaining > 0)
      hint.textContent = 'Paused — pick it back up when ready.';
    else if (focus.remaining === 0) hint.textContent = 'Session complete. Take a breath.';
    else hint.textContent = `${focus.duration / 60} minutes of deep work`;
  }

  updateTitle();
}

function stopFocusTimer() {
  clearInterval(focus.timer);
  focus.timer = null;
}

function completeFocus() {
  stopFocusTimer();
  focus.running = false;
  focus.remaining = 0;
  renderFocus();
  toast('Focus session complete. Take a breath.');
}

function toggleFocus() {
  if (focus.running) {
    focus.remaining = Math.max(0, Math.ceil((focus.endsAt - Date.now()) / 1000));
    focus.running = false;
    stopFocusTimer();
    renderFocus();
    return;
  }

  if (focus.remaining <= 0) focus.remaining = focus.duration;
  focus.running = true;
  focus.endsAt = Date.now() + focus.remaining * 1000;
  stopFocusTimer();
  focus.timer = setInterval(() => {
    focus.remaining = Math.max(0, Math.ceil((focus.endsAt - Date.now()) / 1000));
    renderFocus();
    if (focus.remaining <= 0) completeFocus();
  }, 250);
  renderFocus();
}

function resetFocus() {
  stopFocusTimer();
  focus.running = false;
  focus.remaining = focus.duration;
  renderFocus();
}

function cycleFocusPreset() {
  if (focus.running) {
    toast('Pause the timer before changing the session length.');
    return;
  }
  focus.presetIndex = (focus.presetIndex + 1) % FOCUS_PRESETS.length;
  focus.duration = FOCUS_PRESETS[focus.presetIndex] * 60;
  focus.remaining = focus.duration;
  renderFocus();
}

/* ------------------------------------------------------------------ */
/* Weather                                                             */
/* ------------------------------------------------------------------ */

function readWeatherCache() {
  try {
    const raw = localStorage.getItem(WEATHER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Number.isFinite(parsed.at) || !Number.isFinite(parsed.temp)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function weatherIconName(code) {
  if (code === 0) return 'i-sun';
  if (code >= 1 && code <= 3) return 'i-cloud-sun';
  if (code === 45 || code === 48) return 'i-fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'i-rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'i-snow';
  if (code >= 95) return 'i-storm';
  return 'i-cloud';
}

function weatherButton({ action = '', label = '', icon = 'i-cloud', className = '' } = {}) {
  const button = element('button', `weather-chip ${className}`.trim());
  button.type = 'button';
  if (action) button.dataset.action = action;
  button.append(svgIcon(icon), element('span', '', label));
  return button;
}

function renderWeather() {
  const slot = $('#weatherSlot');
  if (!slot) return;
  slot.replaceChildren();
  const weather = state.settings.weather;

  if (!weather.enabled || weather.lat === null || weather.lon === null) {
    slot.append(
      weatherButton({
        action: 'weather-enable',
        label: 'Add weather',
        icon: 'i-cloud-sun',
        className: 'weather-chip--button',
      }),
    );
    return;
  }

  if (weatherLoading && !weatherCache) {
    slot.append(weatherButton({ label: 'Loading weather…', icon: 'i-cloud' }));
    return;
  }

  if (weatherCache) {
    const button = element('button', 'weather-chip');
    button.type = 'button';
    button.dataset.action = 'open-settings';
    button.title = `Feels like ${weatherCache.apparent}° · ${weatherCache.label || weather.label}`;
    button.append(
      svgIcon(weatherIconName(weatherCache.code)),
      element('strong', '', `${weatherCache.temp}°`),
      element('span', '', weatherCache.label || weather.label || 'Local weather'),
    );
    slot.append(button);
    return;
  }

  slot.append(
    weatherButton({
      action: 'refresh-weather',
      label: weatherError ? 'Weather unavailable' : 'Load weather',
      icon: 'i-cloud',
      className: 'weather-chip--button',
    }),
  );
}

async function loadWeather(force = false) {
  const weather = state.settings.weather;
  if (!weather.enabled || weather.lat === null || weather.lon === null) return;

  weatherCache = readWeatherCache();
  if (!force && weatherCache && Date.now() - weatherCache.at < WEATHER_TTL) {
    renderWeather();
    return;
  }

  weatherLoading = true;
  weatherError = false;
  renderWeather();

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(weather.lat)}` +
      `&longitude=${encodeURIComponent(weather.lon)}` +
      '&current=temperature_2m,apparent_temperature,weather_code&timezone=auto';
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Weather request failed');
    const data = await response.json();
    const current = data.current;
    if (!current || !Number.isFinite(current.temperature_2m)) throw new Error('No weather data');

    weatherCache = {
      at: Date.now(),
      temp: Math.round(current.temperature_2m),
      apparent: Math.round(current.apparent_temperature ?? current.temperature_2m),
      code: Number(current.weather_code) || 0,
      label: weather.label,
    };
    localStorage.setItem(WEATHER_KEY, JSON.stringify(weatherCache));
  } catch {
    weatherError = true;
    /* Keep a stale reading rather than showing an empty chip offline. */
    weatherCache = weatherCache || null;
  } finally {
    weatherLoading = false;
    renderWeather();
  }
}

function enableWeather() {
  const weather = state.settings.weather;
  if (weather.lat !== null && weather.lon !== null) {
    weather.enabled = true;
    persist();
    renderWeather();
    renderSettings(true);
    loadWeather(true);
    return;
  }

  if (!navigator.geolocation) {
    openSettings();
    toast('This browser cannot share a location. Pick a city in Settings.');
    return;
  }

  toast('Waiting for your location…');
  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.settings.weather = {
        enabled: true,
        lat: Number(position.coords.latitude.toFixed(4)),
        lon: Number(position.coords.longitude.toFixed(4)),
        label: 'My location',
      };
      localStorage.removeItem(WEATHER_KEY);
      weatherCache = null;
      persist();
      renderWeather();
      renderSettings(true);
      loadWeather(true);
      toast('Weather is on. You can change the city in Settings.');
    },
    () => {
      openSettings();
      toast('Location blocked. Pick a city in Settings.');
    },
    { timeout: 9000, maximumAge: 10 * 60 * 1000 },
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

function renderAccentSwatches() {
  const container = $('#accentSwatches');
  if (!container) return;
  container.replaceChildren();
  ACCENTS.forEach((accent) => {
    const button = element('button', 'swatch swatch--lg');
    button.type = 'button';
    button.dataset.action = 'pick-accent';
    button.dataset.accentId = accent.id;
    button.style.setProperty('--swatch-color', accent.color);
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(accent.id === state.settings.accent));
    button.setAttribute('aria-label', `${accent.name} accent`);
    button.title = accent.name;
    container.append(button);
  });
}

function renderBoardList() {
  const container = $('#boardList');
  if (!container) return;
  container.replaceChildren();
  state.boards.forEach((board) => {
    const row = element('div', 'board-row');
    const symbol = element('span', 'board-row__symbol', board.symbol);
    symbol.setAttribute('aria-hidden', 'true');
    const name = element('span', 'board-row__name', board.name);
    const count = element(
      'span',
      'board-row__count',
      `${board.links.length} tile${board.links.length === 1 ? '' : 's'}`,
    );
    const edit = element('button', 'icon-btn icon-btn--sm');
    edit.type = 'button';
    edit.dataset.action = 'edit-board';
    edit.dataset.id = board.id;
    edit.setAttribute('aria-label', `Edit board ${board.name}`);
    edit.append(svgIcon('i-edit'));
    row.append(symbol, name, count, edit);
    container.append(row);
  });
}

function renderSettings(force = false) {
  const dialog = $('#settingsDialog');
  if (!dialog?.open && !force) return;

  $$('input[name="theme"]').forEach((input) => {
    input.checked = input.value === state.settings.theme;
  });

  const bgSelect = $('#bgSelect');
  if (bgSelect) bgSelect.value = state.settings.background;

  const use24h = $('#use24h');
  if (use24h) use24h.checked = state.settings.use24h;

  const siteIcons = $('#siteIcons');
  if (siteIcons) siteIcons.checked = state.settings.siteIcons;

  const weatherEnabled = $('#weatherEnabled');
  if (weatherEnabled) weatherEnabled.checked = state.settings.weather.enabled;

  const weatherLabel = $('#weatherLabel');
  if (weatherLabel) {
    const weather = state.settings.weather;
    weatherLabel.textContent =
      weather.lat !== null && weather.lon !== null
        ? `${weather.label || 'Location'} · ${weather.lat.toFixed(2)}, ${weather.lon.toFixed(2)}`
        : 'No location set. Search a city or allow location access.';
  }

  const version = $('#versionLabel');
  if (version) version.textContent = `v${APP_VERSION}`;

  renderAccentSwatches();
  renderBoardList();
  updateStorageMeta();

  const storageMeta = $('#storageMeta');
  if (storageMeta) {
    storageMeta.textContent = `${formatBytes(storageBytes())} stored on this device. Export a backup to keep it safe.`;
  }
}

function openSettings() {
  closeAllDialogs();
  const dialog = $('#settingsDialog');
  if (!dialog) return;
  renderSettings(true);
  $('#cityResults')?.replaceChildren();
  showDialog(dialog);
  if (state.settings.weather.enabled) loadWeather();
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

function renderStats() {
  const boards = state.boards.length;
  const tiles = countLinks(state);
  const done = state.boards.reduce(
    (total, board) => total + board.tasks.filter((task) => task.done).length,
    0,
  );

  const statLinks = $('#statLinks');
  if (statLinks) statLinks.textContent = String(tiles);
  const statBoards = $('#statBoards');
  if (statBoards) statBoards.textContent = String(boards);
  const statTasks = $('#statTasks');
  if (statTasks) statTasks.textContent = String(done);
  updateStorageMeta();
}

/* ------------------------------------------------------------------ */
/* Clock and title                                                     */
/* ------------------------------------------------------------------ */

function updateTitle() {
  const title = focus.running
    ? `${formatDuration(focus.remaining)} · Focus — PATAB`
    : `${formatClock(new Date(), state.settings.use24h)} · PATAB`;
  if (title !== lastTitle) {
    lastTitle = title;
    document.title = title;
  }
}

function tickClock() {
  const now = new Date();
  const clock = $('#clock');
  const date = $('#date');
  const greeting = $('#greeting');
  if (clock) clock.textContent = formatClock(now, state.settings.use24h);
  if (date) date.textContent = dateLabel(now, navigator.language);
  if (greeting) greeting.textContent = greetingFor(now.getHours());
  updateTitle();
}

/* ------------------------------------------------------------------ */
/* Shortcuts panel                                                     */
/* ------------------------------------------------------------------ */

function renderShortcuts() {
  const grid = $('#shortcutsGrid');
  if (!grid) return;
  grid.replaceChildren();
  SHORTCUTS.forEach(([label, keys]) => {
    grid.append(element('span', '', label));
    const holder = element('span', 'keys');
    keys.forEach((key) => holder.append(element('kbd', '', key)));
    grid.append(holder);
  });
}

function openShortcuts() {
  closeAllDialogs();
  renderShortcuts();
  showDialog($('#shortcutsDialog'));
}

/* ------------------------------------------------------------------ */
/* Commands                                                            */
/* ------------------------------------------------------------------ */

function runCommand(id) {
  switch (id) {
    case 'add-link':
      openLinkDialog();
      break;
    case 'add-folder':
      openFolderDialog();
      break;
    case 'add-board':
      openBoardDialog();
      break;
    case 'open-settings':
      openSettings();
      break;
    case 'toggle-theme':
      toggleTheme();
      break;
    case 'open-shortcuts':
      openShortcuts();
      break;
    case 'export':
      exportData();
      break;
    case 'import':
      importData();
      break;
    default:
      break;
  }
}

/* ------------------------------------------------------------------ */
/* Data import / export                                                */
/* ------------------------------------------------------------------ */

function exportData() {
  try {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `patab-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    toast('Backup downloaded. Keep it somewhere safe.');
  } catch {
    toast('Could not create the backup.');
  }
}

function importData() {
  $('#importFile')?.click();
}

async function handleImportFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const next = parseImport(text);
    const confirmed = window.confirm(
      `Replace ${state.boards.length} board${state.boards.length === 1 ? '' : 's'} with ${next.boards.length} from this backup?`,
    );
    if (!confirmed) return;

    state = next;
    localStorage.removeItem(WEATHER_KEY);
    weatherCache = null;
    persist();
    applyAppearance();
    renderAll();
    renderSettings(true);
    closeAllDialogs();
    toast('Backup imported. Welcome back.');
  } catch (error) {
    toast(error?.message || 'Could not import that file.');
  }
}

function resetData() {
  const confirmed = window.confirm(
    'Reset PATAB? This removes every board, link, note and task on this device.',
  );
  if (!confirmed) return;

  state = createSeedState();
  localStorage.removeItem(WEATHER_KEY);
  weatherCache = null;
  persist();
  applyAppearance();
  renderAll();
  renderSettings(true);
  closeAllDialogs();
  toast('PATAB reset to a fresh start.');
}

/* ------------------------------------------------------------------ */
/* All-board render                                                    */
/* ------------------------------------------------------------------ */

function renderAll() {
  applyAppearance();
  renderBoards();
  renderTiles();
  renderNotes();
  renderTasks();
  renderStats();
  renderWeather();
  renderFocus();
  tickClock();
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

function bindShortcutLabels() {
  $$('[data-shortcut="palette"]').forEach((node) => {
    node.textContent = `${modLabel}K`;
  });
  $$('[data-shortcut="focus-search"]').forEach((node) => {
    node.textContent = '/';
  });
}

function syncSearchPlaceholder() {
  const input = $('#searchInput');
  if (!input) return;
  input.placeholder = window.matchMedia('(max-width: 640px)').matches
    ? 'Search or type !g for the web'
    : 'Search your links, or type !g to search the web';
}

function bindSearch() {
  const input = $('#searchInput');
  const form = $('#searchForm');
  const clear = $('.search__clear');
  if (!input || !form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const item = searchItems[searchActive];
    if (item) {
      executeItem(item);
      return;
    }
    const query = input.value.trim();
    if (query) openExternal(webUrl(parseQuery(query).bang || 'ddg', parseQuery(query).term));
  });

  input.addEventListener('focus', () => renderSearch());
  input.addEventListener('input', () => {
    if (clear) clear.hidden = !input.value;
    renderSearch();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSearchActive(searchActive + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSearchActive(searchActive - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = searchItems[searchActive];
      if (item) executeItem(item);
      else {
        const query = input.value.trim();
        if (query) openExternal(webUrl('ddg', query));
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch();
      input.blur();
    }
  });

  clear?.addEventListener('click', () => {
    input.value = '';
    clear.hidden = true;
    input.focus();
    renderSearch();
  });

  const pop = $('#searchResults');
  pop?.addEventListener('click', (event) => {
    const item = event.target.closest('.search-item');
    if (!item) return;
    const index = Number(item.dataset.index);
    executeItem(searchItems[index]);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.search-wrap')) closeSearch();
  });

  document.addEventListener('click', (event) => {
    const hint = event.target.closest('[data-bang]');
    if (!hint) return;
    const bang = hint.dataset.bang;
    input.value = `!${bang} `;
    clear.hidden = false;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    renderSearch();
  });

  document.addEventListener('click', (event) => {
    const tracked = event.target.closest('a[data-track]');
    if (!tracked?.href) return;
    recordRecent({ title: tracked.dataset.title, url: tracked.href });
  });
}

function bindPalette() {
  const dialog = $('#paletteDialog');
  const input = $('#paletteInput');
  const results = $('#paletteResults');
  if (!dialog || !input || !results) return;

  dialog.addEventListener('close', () => {
    /* Nothing to clean up: the next open resets the query. */
  });

  input.addEventListener('input', () => {
    paletteActive = 0;
    renderPalette();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setPaletteActive(paletteActive + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setPaletteActive(paletteActive - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = paletteItems[paletteActive];
      if (item) executeItem(item);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      dialog.close();
    }
  });

  results.addEventListener('click', (event) => {
    const item = event.target.closest('.search-item');
    if (!item) return;
    executeItem(paletteItems[Number(item.dataset.index)]);
  });
}

function bindDialogs() {
  $$('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  document.addEventListener('click', (event) => {
    const closer = event.target.closest('[data-close]');
    if (closer) {
      closer.closest('dialog')?.close();
      return;
    }

    const actionNode = event.target.closest('[data-action]');
    if (!actionNode) return;
    handleAction(actionNode, event);
  });
}

function handleAction(node, event) {
  const action = node.dataset.action;
  const id = node.dataset.id;

  switch (action) {
    case 'switch-board':
      switchBoard(node.dataset.boardId);
      break;
    case 'add-board':
      openBoardDialog();
      break;
    case 'edit-board':
      openBoardDialog(id);
      break;
    case 'add-link':
      openLinkDialog();
      break;
    case 'add-folder':
      openFolderDialog();
      break;
    case 'edit-tile':
      if (findTile(id)?.type === 'folder') openFolderDialog(id);
      else openLinkDialog(id);
      break;
    case 'open-folder':
      openFolder(id);
      break;
    case 'edit-open-folder':
      if (currentFolderId) openFolderDialog(currentFolderId);
      break;
    case 'pick-tone':
      draftTone = node.dataset.tone;
      $$('#linkTones .swatch').forEach((swatch) => {
        swatch.setAttribute('aria-checked', String(swatch.dataset.tone === draftTone));
      });
      break;
    case 'pick-accent':
      state.settings.accent = node.dataset.accentId;
      $$('#accentSwatches .swatch').forEach((swatch) => {
        swatch.setAttribute(
          'aria-checked',
          String(swatch.dataset.accentId === state.settings.accent),
        );
      });
      persist();
      withViewTransition(applyAppearance);
      break;
    case 'add-folder-row': {
      const added = addFolderRow();
      added.title.focus();
      break;
    }
    case 'remove-folder-row':
      node.closest('.folder-row')?.remove();
      break;
    case 'open-palette':
      openPalette();
      break;
    case 'open-settings':
      openSettings();
      break;
    case 'open-shortcuts':
      openShortcuts();
      break;
    case 'toggle-theme':
      toggleTheme();
      break;
    case 'weather-enable':
      enableWeather();
      break;
    case 'refresh-weather':
      loadWeather(true);
      break;
    case 'search-city':
      searchCity();
      break;
    case 'choose-city':
      chooseCity(node);
      break;
    case 'focus-toggle':
      toggleFocus();
      break;
    case 'focus-reset':
      resetFocus();
      break;
    case 'cycle-focus':
      cycleFocusPreset();
      break;
    case 'toggle-task': {
      const board = activeBoard(state);
      const task = board?.tasks.find((item) => item.id === id);
      if (!task) break;
      task.done = !task.done;
      persist();
      renderTasks();
      renderStats();
      break;
    }
    case 'delete-task': {
      const board = activeBoard(state);
      if (!board) break;
      board.tasks = board.tasks.filter((item) => item.id !== id);
      persist();
      renderTasks();
      renderStats();
      break;
    }
    case 'clear-done': {
      const board = activeBoard(state);
      if (!board) break;
      const before = board.tasks.length;
      board.tasks = board.tasks.filter((task) => !task.done);
      if (board.tasks.length === before) {
        toast('Nothing completed to clear.');
        break;
      }
      persist();
      renderTasks();
      renderStats();
      toast('Completed tasks cleared.');
      break;
    }
    case 'clear-notes': {
      const board = activeBoard(state);
      if (!board?.notes) break;
      if (!window.confirm('Clear this scratchpad?')) break;
      board.notes = '';
      persist();
      renderNotes();
      updateNoteMeta();
      break;
    }
    case 'export':
      exportData();
      break;
    case 'import':
      importData();
      break;
    case 'reset':
      resetData();
      break;
    case 'install':
      installApp();
      break;
    case 'delete-link':
      deleteEditingLink();
      break;
    case 'delete-folder':
      deleteEditingFolder();
      break;
    case 'delete-board':
      deleteEditingBoard();
      break;
    case 'clear-search': {
      const input = $('#searchInput');
      if (!input) break;
      input.value = '';
      input.focus();
      renderSearch();
      break;
    }
    default:
      break;
  }

  if (action === 'weather-enable' || action === 'open-settings') {
    event.preventDefault();
  }
}

function bindForms() {
  $('#linkForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    saveLink();
  });

  $('#folderForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    saveFolder();
  });

  $('#boardForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    saveBoard();
  });

  $('#linkUrl')?.addEventListener('blur', () => {
    const urlInput = $('#linkUrl');
    const titleInput = $('#linkTitle');
    if (!urlInput || !titleInput || titleInput.value.trim()) return;
    const url = normalizeUrl(urlInput.value);
    if (url) titleInput.value = hostOf(url);
  });

  $('#taskForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = $('#taskInput');
    const text = input?.value.trim() || '';
    if (!text) return;
    const board = activeBoard(state);
    if (!board) return;
    board.tasks.push({ id: uid('task'), text: text.slice(0, 180), done: false });
    persist();
    renderTasks();
    renderStats();
    if (input) {
      input.value = '';
      input.focus();
    }
  });

  $('#notes')?.addEventListener('input', (event) => {
    const board = activeBoard(state);
    if (!board) return;
    board.notes = event.target.value.slice(0, 20000);
    updateNoteMeta();
    const status = $('#noteStatus');
    if (status) status.textContent = 'Saving…';
    scheduleSave();
    clearTimeout(noteSaveTimer);
    noteSaveTimer = setTimeout(() => {
      if (status) status.textContent = 'Saved';
    }, 700);
  });

  $('#settingsDialog')?.addEventListener('change', (event) => {
    const target = event.target;
    if (target.name === 'theme') {
      setTheme(target.value);
    } else if (target.id === 'bgSelect') {
      state.settings.background = target.value;
      persist();
      applyAppearance();
    } else if (target.id === 'use24h') {
      state.settings.use24h = target.checked;
      persist();
      tickClock();
    } else if (target.id === 'siteIcons') {
      state.settings.siteIcons = target.checked;
      persist();
      renderTiles();
      toast(target.checked ? 'Site icons on.' : 'Site icons off. Monograms only.');
    } else if (target.id === 'weatherEnabled') {
      if (target.checked) {
        enableWeather();
      } else {
        state.settings.weather.enabled = false;
        persist();
        renderWeather();
        renderSettings(true);
      }
    }
  });

  $('#importFile')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    handleImportFile(file).finally(() => {
      event.target.value = '';
    });
  });

  const tasks = $('#tasks');
  tasks?.addEventListener('click', (event) => {
    /* Actions are handled by the global delegate; this keeps focus tidy. */
    if (event.target.closest('.task__check')) event.preventDefault();
  });
}

function saveLink() {
  const titleInput = $('#linkTitle');
  const urlInput = $('#linkUrl');
  const errorNode = $('#linkError');
  const url = normalizeUrl(urlInput?.value || '');

  if (!url) {
    if (errorNode) {
      errorNode.textContent = 'Enter a valid http(s) URL, like github.com.';
      errorNode.hidden = false;
    }
    urlInput?.focus();
    return;
  }

  if (errorNode) errorNode.hidden = true;
  const title = titleInput?.value.trim().slice(0, 60) || hostOf(url);
  const board = activeBoard(state);
  if (!board) return;

  if (editingLinkId) {
    const tile = board.links.find((item) => item.id === editingLinkId);
    if (tile && tile.type === 'link') {
      tile.title = title;
      tile.url = url;
      tile.tone = draftTone;
    }
  } else {
    board.links.push({
      id: uid('link'),
      type: 'link',
      title,
      url,
      tone: draftTone,
    });
  }

  persist();
  renderTiles();
  renderStats();
  closeAllDialogs();
  toast(editingLinkId ? 'Link updated.' : 'Link added to this board.');
  editingLinkId = null;
}

function deleteEditingLink() {
  if (!editingLinkId) return;
  const board = activeBoard(state);
  const tile = board?.links.find((item) => item.id === editingLinkId);
  if (!tile) return;
  if (!window.confirm(`Remove “${tile.title}” from this board?`)) return;
  board.links = board.links.filter((item) => item.id !== editingLinkId);
  persist();
  renderTiles();
  renderStats();
  closeAllDialogs();
  editingLinkId = null;
  toast('Link removed.');
}

function saveFolder() {
  const titleInput = $('#folderTitle');
  const errorNode = $('#folderError');
  const title = titleInput?.value.trim().slice(0, 40) || 'Folder';
  const { items, error } = collectFolderItems();

  if (error) {
    if (errorNode) {
      errorNode.textContent = error;
      errorNode.hidden = false;
    }
    return;
  }

  if (errorNode) errorNode.hidden = true;
  const board = activeBoard(state);
  if (!board) return;

  if (editingFolderId) {
    const folder = board.links.find((item) => item.id === editingFolderId);
    if (folder && folder.type === 'folder') {
      folder.title = title;
      folder.items = items;
    }
  } else {
    board.links.push({
      id: uid('folder'),
      type: 'folder',
      title,
      items,
    });
  }

  persist();
  renderTiles();
  renderStats();
  closeAllDialogs();
  toast(editingFolderId ? 'Folder updated.' : 'Folder added.');
  editingFolderId = null;
}

function deleteEditingFolder() {
  if (!editingFolderId) return;
  const board = activeBoard(state);
  const folder = board?.links.find((item) => item.id === editingFolderId);
  if (!folder) return;
  if (!window.confirm(`Remove the folder “${folder.title}” and its links?`)) return;
  board.links = board.links.filter((item) => item.id !== editingFolderId);
  persist();
  renderTiles();
  renderStats();
  closeAllDialogs();
  editingFolderId = null;
  currentFolderId = null;
  toast('Folder removed.');
}

function saveBoard() {
  const nameInput = $('#boardName');
  const symbolInput = $('#boardSymbol');
  const name = nameInput?.value.trim().slice(0, 32) || 'Untitled';
  const symbol = Array.from(symbolInput?.value.trim() || '')
    .slice(0, 2)
    .join('') || '•';

  if (editingBoardId) {
    const board = state.boards.find((item) => item.id === editingBoardId);
    if (board) {
      board.name = name;
      board.symbol = symbol;
    }
  } else {
    const board = {
      id: uid('board'),
      name,
      symbol,
      links: [],
      notes: '',
      tasks: [],
    };
    state.boards.push(board);
    state.activeBoardId = board.id;
  }

  persist();
  renderAll();
  renderSettings(true);
  closeAllDialogs();
  toast(editingBoardId ? 'Board updated.' : 'Board created.');
  editingBoardId = null;
}

function deleteEditingBoard() {
  if (!editingBoardId) return;
  if (state.boards.length <= 1) {
    toast('Keep at least one board.');
    return;
  }
  const board = state.boards.find((item) => item.id === editingBoardId);
  if (!board) return;
  if (!window.confirm(`Delete the board “${board.name}” and everything in it?`)) return;

  state.boards = state.boards.filter((item) => item.id !== editingBoardId);
  if (state.activeBoardId === editingBoardId) state.activeBoardId = state.boards[0].id;
  persist();
  renderAll();
  renderSettings(true);
  closeAllDialogs();
  editingBoardId = null;
  toast('Board deleted.');
}

/* ------------------------------------------------------------------ */
/* City search                                                         */
/* ------------------------------------------------------------------ */

async function searchCity() {
  const input = $('#cityInput');
  const results = $('#cityResults');
  const query = input?.value.trim() || '';
  if (!input || !results || query.length < 2) {
    if (input) input.focus();
    return;
  }

  const button = $('[data-action="search-city"]');
  if (button) button.disabled = true;
  results.replaceChildren(element('div', 'search-empty', 'Searching…'));

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('City search failed');
    const data = await response.json();
    const places = Array.isArray(data.results) ? data.results : [];
    results.replaceChildren();

    if (!places.length) {
      results.append(element('div', 'search-empty', 'No city found. Try another spelling.'));
      return;
    }

    places.forEach((place) => {
      const buttonNode = element('button', 'city-result');
      buttonNode.type = 'button';
      buttonNode.dataset.action = 'choose-city';
      buttonNode.dataset.lat = String(place.latitude);
      buttonNode.dataset.lon = String(place.longitude);
      const region = [place.name, place.country_code || place.country].filter(Boolean).join(', ');
      buttonNode.dataset.label = region;
      buttonNode.append(
        document.createTextNode(place.name),
        element('span', '', [place.admin1, place.country_code].filter(Boolean).join(' · ')),
      );
      results.append(buttonNode);
    });
  } catch {
    results.replaceChildren(
      element('div', 'search-empty', 'Could not reach the weather service. Try again.'),
    );
  } finally {
    if (button) button.disabled = false;
  }
}

function chooseCity(node) {
  const lat = Number(node.dataset.lat);
  const lon = Number(node.dataset.lon);
  const label = node.dataset.label || 'Location';
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  state.settings.weather = { enabled: true, lat, lon, label };
  localStorage.removeItem(WEATHER_KEY);
  weatherCache = null;
  persist();
  renderWeather();
  renderSettings(true);
  $('#cityResults')?.replaceChildren();
  loadWeather(true);
  toast(`Weather set to ${label}.`);
}

/* ------------------------------------------------------------------ */
/* Install                                                             */
/* ------------------------------------------------------------------ */

async function installApp() {
  if (!deferredInstall) {
    toast('Open your browser menu and choose “Install PATAB”.');
    return;
  }
  deferredInstall.prompt();
  try {
    await deferredInstall.userChoice;
  } catch {
    /* The prompt may be dismissed. */
  }
  deferredInstall = null;
  const button = $('#installBtn');
  if (button) button.hidden = true;
}

/* ------------------------------------------------------------------ */
/* Drag and drop                                                       */
/* ------------------------------------------------------------------ */

function bindDragAndDrop() {
  const container = $('#tiles');
  if (!container) return;
  let draggingId = null;

  const clearMarkers = () => {
    $$('.tile', container).forEach((tile) => {
      tile.classList.remove('drop-before', 'drop-after');
    });
  };

  container.addEventListener('dragstart', (event) => {
    const tile = event.target.closest('.tile:not(.tile--add)');
    if (!tile) {
      event.preventDefault();
      return;
    }
    draggingId = tile.dataset.id;
    tile.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggingId);
  });

  container.addEventListener('dragend', () => {
    draggingId = null;
    clearMarkers();
    $$('.tile.is-dragging', container).forEach((tile) => tile.classList.remove('is-dragging'));
  });

  container.addEventListener('dragover', (event) => {
    if (!draggingId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    clearMarkers();
    const target = event.target.closest('.tile:not(.tile--add)');
    if (!target || target.dataset.id === draggingId) return;
    const rect = target.getBoundingClientRect();
    const after = event.clientX > rect.left + rect.width / 2;
    target.classList.add(after ? 'drop-after' : 'drop-before');
  });

  container.addEventListener('drop', (event) => {
    if (!draggingId) return;
    event.preventDefault();
    const board = activeBoard(state);
    if (!board) return;

    const target = event.target.closest('.tile:not(.tile--add)');
    const from = board.links.findIndex((tile) => tile.id === draggingId);
    if (from === -1) return;

    let to = board.links.length - 1;
    if (target && target.dataset.id !== draggingId) {
      const targetIndex = board.links.findIndex((tile) => tile.id === target.dataset.id);
      if (targetIndex === -1) return;
      const rect = target.getBoundingClientRect();
      const after = event.clientX > rect.left + rect.width / 2;
      const adjusted = targetIndex - (from < targetIndex ? 1 : 0);
      to = adjusted + (after ? 1 : 0);
    }

    board.links = moveItem(board.links, from, Math.max(0, Math.min(to, board.links.length - 1)));
    draggingId = null;
    clearMarkers();
    persist();
    renderTiles();
  });

  container.addEventListener('keydown', (event) => {
    if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    const tileNode = event.target.closest('.tile:not(.tile--add)');
    if (!tileNode) return;
    event.preventDefault();
    const board = activeBoard(state);
    if (!board) return;
    const from = board.links.findIndex((tile) => tile.id === tileNode.dataset.id);
    if (from === -1) return;
    const to = event.key === 'ArrowLeft' ? from - 1 : from + 1;
    if (to < 0 || to >= board.links.length) return;
    const id = board.links[from].id;
    board.links = moveItem(board.links, from, to);
    persist();
    renderTiles();
    requestAnimationFrame(() => {
      $(`.tile[data-id="${id}"] .tile__main`)?.focus();
    });
  });
}

/* ------------------------------------------------------------------ */
/* Global keyboard                                                     */
/* ------------------------------------------------------------------ */

function bindGlobalKeys() {
  document.addEventListener('keydown', (event) => {
    const meta = event.metaKey || event.ctrlKey;
    if (meta && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openPalette();
      return;
    }

    if (event.key === 'Escape') {
      closeSearch();
      return;
    }

    const active = document.activeElement;
    const typing =
      active &&
      (active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.tagName === 'SELECT' ||
        active.isContentEditable);
    if (typing) return;

    const dialogOpen = Boolean($('dialog[open]'));
    if (dialogOpen) return;

    if (event.key === '/') {
      event.preventDefault();
      openSearchFocus();
    } else if (event.key === '?') {
      event.preventDefault();
      openShortcuts();
    } else if (event.key.toLowerCase() === 'n') {
      event.preventDefault();
      openLinkDialog();
    }
  });
}

function openSearchFocus() {
  const input = $('#searchInput');
  if (!input) return;
  input.focus();
  input.select();
  renderSearch();
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

function bindWeather() {
  window.addEventListener('online', () => {
    if (state.settings.weather.enabled) loadWeather();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    tickClock();
    if (
      state.settings.weather.enabled &&
      (!weatherCache || Date.now() - weatherCache.at > WEATHER_TTL)
    ) {
      loadWeather();
    }
  });
}

function bindInstall() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstall = event;
    const button = $('#installBtn');
    if (button) button.hidden = false;
  });

  if (window.matchMedia('(display-mode: standalone)').matches) {
    const button = $('#installBtn');
    if (button) button.hidden = true;
  }
}

function bindServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!/^https?:$/.test(location.protocol)) return;
  const register = () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* Offline support is a bonus, not a requirement. */
    });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

function bindCrossTabSync() {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    const active = document.activeElement;
    if (active?.matches('input, textarea, [contenteditable="true"]')) return;
    try {
      state = normalizeState(JSON.parse(event.newValue));
      applyAppearance();
      renderAll();
      renderSettings(true);
    } catch {
      /* Ignore payloads written by an older version. */
    }
  });
}

function simulateWeatherCache() {
  if (!state.settings.weather.enabled) return;
  weatherCache = readWeatherCache();
  loadWeather();
}

function init() {
  if (loaded.fresh) persist();
  applyAppearance();
  bindShortcutLabels();
  syncSearchPlaceholder();
  window.matchMedia('(max-width: 640px)').addEventListener('change', syncSearchPlaceholder);
  bindSearch();
  bindPalette();
  bindDialogs();
  bindForms();
  bindDragAndDrop();
  bindGlobalKeys();
  bindWeather();
  bindCrossTabSync();
  window.addEventListener('pagehide', persist);

  renderAll();
  renderSettings(true);
  renderShortcuts();

  tickClock();
  setInterval(tickClock, 1000);
  simulateWeatherCache();

  if (location.hash === '#settings') openSettings();
}

bindInstall();
bindServiceWorker();
requestAnimationFrame(() => requestAnimationFrame(init));
