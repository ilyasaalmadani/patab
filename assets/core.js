/**
 * PATAB — core data model, validation and search.
 *
 * This module is deliberately free of DOM access so the whole state layer can
 * be unit-tested with `node --test`. Everything the app stores is normalised
 * here: imported backups, localStorage payloads and seed data all pass through
 * the same validation pipeline.
 */

export const APP_VERSION = '1.0.0';
export const STORAGE_KEY = 'patab:state:v1';
export const WEATHER_KEY = 'patab:weather:v1';

export const ACCENTS = [
  { id: 'lime', name: 'Lime', color: '#c9f24d' },
  { id: 'aqua', name: 'Aqua', color: '#5eead4' },
  { id: 'coral', name: 'Coral', color: '#ff8a6b' },
  { id: 'violet', name: 'Violet', color: '#b79cff' },
  { id: 'gold', name: 'Gold', color: '#f5c451' },
];

export const TONES = ['slate', 'blue', 'violet', 'pink', 'red', 'amber', 'green', 'teal'];

export const BANGS = {
  ddg: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  g: { name: 'Google', url: 'https://www.google.com/search?q=' },
  yt: { name: 'YouTube', url: 'https://www.youtube.com/results?search_query=' },
  gh: { name: 'GitHub', url: 'https://github.com/search?q=' },
  w: { name: 'Wikipedia', url: 'https://en.wikipedia.org/w/index.php?search=' },
  npm: { name: 'npm', url: 'https://www.npmjs.com/search?q=' },
  maps: { name: 'Maps', url: 'https://www.google.com/maps/search/' },
  b: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
};

export const DEFAULT_SETTINGS = {
  theme: 'system',
  accent: 'lime',
  background: 'aurora',
  use24h: true,
  siteIcons: true,
  weather: {
    enabled: false,
    lat: null,
    lon: null,
    label: '',
  },
};

const TONE_HASH = {
  slate: 'linear-gradient(145deg, #9aa7bd, #5f6b80)',
  blue: 'linear-gradient(145deg, #7fb0ff, #3d6ee8)',
  violet: 'linear-gradient(145deg, #c0a6ff, #7b5ce0)',
  pink: 'linear-gradient(145deg, #ffa8d2, #d95296)',
  red: 'linear-gradient(145deg, #ff9b8f, #d94848)',
  amber: 'linear-gradient(145deg, #ffd47a, #d9922b)',
  green: 'linear-gradient(145deg, #a6e88a, #4e9e47)',
  teal: 'linear-gradient(145deg, #7fe7d3, #239c8c)',
};

export function toneGradient(tone) {
  return TONE_HASH[tone] || TONE_HASH.slate;
}

/* ------------------------------------------------------------------ */
/* Small utilities                                                     */
/* ------------------------------------------------------------------ */

export function uid(prefix = 'id') {
  const random =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14).padEnd(12, '0');
  return `${prefix}_${random}`;
}

export function hostOf(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return String(url || '');
  }
}

export function displayUrl(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, '');
    const search = parsed.search ? parsed.search.slice(0, 40) : '';
    return `${parsed.hostname.replace(/^www\./, '')}${path}${search}`;
  } catch {
    return String(url || '');
  }
}

export function faviconUrl(url, size = 64) {
  const host = hostOf(url);
  if (!host) return '';
  return `https://www.google.com/s2/favicons?sz=${size}&domain=${encodeURIComponent(host)}`;
}

export function toneFor(value) {
  const text = String(value || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return TONES[hash % TONES.length];
}

export function normalizeUrl(input) {
  if (typeof input !== 'string') return '';
  let value = input.trim();
  if (!value || value.length > 2048) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = `https://${value}`;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    if (!parsed.hostname || /\s/.test(parsed.hostname)) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

export function normalizeBoardName(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 32) : '';
}

function safeText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeId(value, prefix) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{3,64}$/.test(value) ? value : uid(prefix);
}

function safeSymbol(value) {
  if (typeof value !== 'string') return '•';
  const symbol = Array.from(value.trim()).slice(0, 2).join('');
  return symbol || '•';
}

/* ------------------------------------------------------------------ */
/* Seed data                                                           */
/* ------------------------------------------------------------------ */

function seedLink(title, url, tone) {
  return { id: uid('link'), type: 'link', title, url, tone };
}

function seedFolder(title, items) {
  return { id: uid('folder'), type: 'folder', title, items };
}

export function createSeedState() {
  const daily = {
    id: uid('board'),
    name: 'Daily',
    symbol: '◐',
    links: [
      seedLink('GitHub', 'https://github.com', 'slate'),
      seedLink('Gmail', 'https://mail.google.com', 'red'),
      seedLink('Calendar', 'https://calendar.google.com', 'blue'),
      seedLink('Notion', 'https://www.notion.so', 'slate'),
      seedLink('Figma', 'https://www.figma.com', 'pink'),
      seedLink('YouTube', 'https://www.youtube.com', 'red'),
      seedLink('Hacker News', 'https://news.ycombinator.com', 'amber'),
      seedLink('X', 'https://x.com', 'slate'),
      seedFolder('Studio', [
        seedLink('Vercel', 'https://vercel.com', 'slate'),
        seedLink('Linear', 'https://linear.app', 'violet'),
        seedLink('Cloudflare', 'https://dash.cloudflare.com', 'amber'),
        seedLink('Excalidraw', 'https://excalidraw.com', 'violet'),
      ]),
    ],
    notes:
      'The internet is loud.\nThis tab is quiet.\n\nJot down what matters, then close the tab.',
    tasks: [
      { id: uid('task'), text: 'Shape the day — one task at a time', done: true },
      { id: uid('task'), text: 'Open the command palette to jump anywhere', done: false },
      { id: uid('task'), text: 'Make PATAB yours in Settings', done: false },
    ],
  };

  const workshop = {
    id: uid('board'),
    name: 'Workshop',
    symbol: '◇',
    links: [
      seedLink('npm', 'https://www.npmjs.com', 'red'),
      seedLink('MDN', 'https://developer.mozilla.org', 'blue'),
      seedLink('Stack Overflow', 'https://stackoverflow.com', 'amber'),
      seedLink('Can I use', 'https://caniuse.com', 'green'),
      seedLink('CodePen', 'https://codepen.io', 'slate'),
      seedLink('Dribbble', 'https://dribbble.com', 'pink'),
      seedLink('Raycast', 'https://www.raycast.com', 'red'),
      seedLink('Are.na', 'https://www.are.na', 'teal'),
    ],
    notes: 'Ideas worth keeping:\n\n- ',
    tasks: [],
  };

  return {
    version: 1,
    activeBoardId: daily.id,
    boards: [daily, workshop],
    settings: {
      ...DEFAULT_SETTINGS,
      weather: { ...DEFAULT_SETTINGS.weather },
    },
    meta: {
      createdAt: new Date().toISOString(),
      recent: [],
    },
  };
}

/* ------------------------------------------------------------------ */
/* Normalisation / migration                                           */
/* ------------------------------------------------------------------ */

function normalizeLink(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const url = normalizeUrl(raw.url);
  if (!url) return null;
  return {
    id: safeId(raw.id, 'link'),
    type: 'link',
    title: safeText(raw.title, 60) || hostOf(url),
    url,
    tone: TONES.includes(raw.tone) ? raw.tone : toneFor(url),
  };
}

function normalizeFolder(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const items = Array.isArray(raw.items)
    ? raw.items.map(normalizeLink).filter(Boolean).slice(0, 24)
    : [];
  if (!items.length) return null;
  return {
    id: safeId(raw.id, 'folder'),
    type: 'folder',
    title: safeText(raw.title, 40) || 'Folder',
    items,
  };
}

function normalizeTask(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const text = safeText(raw.text, 180);
  if (!text) return null;
  return {
    id: safeId(raw.id, 'task'),
    text,
    done: raw.done === true,
  };
}

function normalizeBoard(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const links = Array.isArray(raw.links)
    ? raw.links
        .map((item) => (item?.type === 'folder' ? normalizeFolder(item) : normalizeLink(item)))
        .filter(Boolean)
        .slice(0, 64)
    : [];
  const seen = new Set();
  const unique = links.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return {
    id: safeId(raw.id, 'board'),
    name: normalizeBoardName(raw.name) || 'Untitled',
    symbol: safeSymbol(raw.symbol),
    links: unique,
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 20000) : '',
    tasks: Array.isArray(raw.tasks)
      ? raw.tasks.map(normalizeTask).filter(Boolean).slice(0, 60)
      : [],
  };
}

function normalizeSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const weather = source.weather && typeof source.weather === 'object' ? source.weather : {};
  const hasRawCoords =
    weather.lat !== null &&
    weather.lat !== undefined &&
    weather.lat !== '' &&
    weather.lon !== null &&
    weather.lon !== undefined &&
    weather.lon !== '';
  const lat = Number(weather.lat);
  const lon = Number(weather.lon);
  const hasCoords =
    hasRawCoords &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180;

  return {
    theme: ['system', 'dark', 'light'].includes(source.theme) ? source.theme : DEFAULT_SETTINGS.theme,
    accent: ACCENTS.some((accent) => accent.id === source.accent)
      ? source.accent
      : DEFAULT_SETTINGS.accent,
    background: ['aurora', 'grid', 'plain'].includes(source.background)
      ? source.background
      : DEFAULT_SETTINGS.background,
    use24h: typeof source.use24h === 'boolean' ? source.use24h : DEFAULT_SETTINGS.use24h,
    siteIcons:
      typeof source.siteIcons === 'boolean' ? source.siteIcons : DEFAULT_SETTINGS.siteIcons,
    weather: {
      enabled: hasCoords ? weather.enabled === true : false,
      lat: hasCoords ? lat : null,
      lon: hasCoords ? lon : null,
      label: hasCoords ? safeText(weather.label, 40) : '',
    },
  };
}

function normalizeRecent(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const url = normalizeUrl(entry.url);
      if (!url) return null;
      return { title: safeText(entry.title, 60) || hostOf(url), url };
    })
    .filter(Boolean)
    .slice(0, 8);
}

/**
 * Normalise anything that claims to be PATAB state.
 * Invalid boards/tiles are dropped; an empty or corrupt payload yields the
 * seed state so the app never boots into a broken screen.
 */
export function normalizeState(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.boards)) {
    return createSeedState();
  }

  const boards = raw.boards.map(normalizeBoard).filter(Boolean).slice(0, 12);
  if (!boards.length) return createSeedState();

  const activeBoardId = boards.some((board) => board.id === raw.activeBoardId)
    ? raw.activeBoardId
    : boards[0].id;

  return {
    version: 1,
    activeBoardId,
    boards,
    settings: normalizeSettings(raw.settings),
    meta: {
      createdAt:
        typeof raw.meta?.createdAt === 'string' ? raw.meta.createdAt : new Date().toISOString(),
      recent: normalizeRecent(raw.meta?.recent),
    },
  };
}

export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.boards)) {
    throw new Error('This does not look like a PATAB backup.');
  }
  const state = normalizeState(data);
  if (!state.boards.length) throw new Error('The backup contains no boards.');
  return state;
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Score a query against a haystack. Exact and prefix matches rank far above
 * scattered subsequences. Returns 0 when the query does not match at all.
 */
export function fuzzyScore(query, text) {
  const q = normalizeSearchText(query).replace(/\s+/g, ' ').trim();
  const t = normalizeSearchText(text);
  if (!q || !t) return 0;

  if (t === q) return 1200;
  const direct = t.indexOf(q);
  if (direct === 0) return 1000;
  if (direct > 0) {
    const boundary = /[\s\-_/.:]/.test(t[direct - 1]) ? 820 : 700;
    return Math.max(320, boundary - Math.min(direct, 160));
  }

  let cursor = 0;
  let score = 0;
  let streak = 0;
  for (const char of q) {
    if (char === ' ') continue;
    const found = t.indexOf(char, cursor);
    if (found === -1) return 0;
    if (found === cursor) {
      streak += 1;
      score += 7 + streak * 3;
    } else {
      streak = 0;
      score += 2;
    }
    cursor = found + 1;
  }
  return Math.max(1, score - Math.floor(t.length / 40));
}

export function parseQuery(raw) {
  const value = String(raw || '').trim();
  const bang = value.match(/^!([a-z]+)(?:\s+([\s\S]*))?$/i);
  if (bang) {
    const id = bang[1].toLowerCase();
    if (BANGS[id]) return { type: 'bang', bang: id, term: (bang[2] || '').trim() };
  }
  return { type: 'text', term: value };
}

export function webUrl(bangId, term) {
  const bang = BANGS[bangId] || BANGS.ddg;
  if (!term) return bang.url.split('?')[0];
  return `${bang.url}${encodeURIComponent(term)}`;
}

/**
 * Find matching links and folders across every board.
 * Folders are returned both as themselves and as their children, so a search
 * for "linear" works even when the link is tucked inside "Studio".
 */
export function searchLinks(state, rawQuery, { limit = 8 } = {}) {
  const query = String(rawQuery || '').trim();
  if (!query || query.startsWith('!') || !state?.boards) return [];

  const results = [];
  for (const board of state.boards) {
    for (const tile of board.links) {
      if (tile.type === 'folder') {
        const folderScore = fuzzyScore(query, tile.title);
        if (folderScore > 0) {
          results.push({
            kind: 'folder',
            id: tile.id,
            title: tile.title,
            url: '',
            tone: 'slate',
            boardId: board.id,
            boardName: board.name,
            score: folderScore + 40,
          });
        }
        for (const item of tile.items) {
          const score = Math.max(
            fuzzyScore(query, item.title) * 1.15,
            fuzzyScore(query, hostOf(item.url)) * 0.9,
            fuzzyScore(query, tile.title) * 0.45,
          );
          if (score > 0) {
            results.push({
              kind: 'link',
              id: item.id,
              title: item.title,
              url: item.url,
              tone: item.tone,
              boardId: board.id,
              boardName: board.name,
              folderId: tile.id,
              folderName: tile.title,
              score: score + 30,
            });
          }
        }
      } else {
        const score = Math.max(
          fuzzyScore(query, tile.title) * 1.15,
          fuzzyScore(query, hostOf(tile.url)) * 0.9,
          fuzzyScore(query, board.name) * 0.5,
        );
        if (score > 0) {
          results.push({
            kind: 'link',
            id: tile.id,
            title: tile.title,
            url: tile.url,
            tone: tile.tone,
            boardId: board.id,
            boardName: board.name,
            score,
          });
        }
      }
    }
  }

  const seen = new Set();
  return results
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .filter((item) => {
      const key = `${item.kind}:${item.url || item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Presentation helpers                                                */
/* ------------------------------------------------------------------ */

export function formatClock(date, use24h = true) {
  const hours = use24h ? date.getHours() : date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${use24h ? String(hours).padStart(2, '0') : hours}:${minutes}`;
}

export function dateLabel(date, locale = undefined) {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(date);
  } catch {
    return date.toDateString();
  }
}

export function greetingFor(hour) {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function countLinks(state) {
  if (!state?.boards) return 0;
  return state.boards.reduce(
    (total, board) =>
      total +
      board.links.reduce(
        (count, tile) => count + (tile.type === 'folder' ? tile.items.length : 1),
        0,
      ),
    0,
  );
}

export function countTasks(state, boardId = state?.activeBoardId) {
  const board = state?.boards?.find((item) => item.id === boardId);
  if (!board) return { total: 0, done: 0 };
  return {
    total: board.tasks.length,
    done: board.tasks.filter((task) => task.done).length,
  };
}

export function moveItem(list, from, to) {
  if (!Array.isArray(list)) return list;
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function activeBoard(state) {
  return (
    state?.boards?.find((board) => board.id === state.activeBoardId) || state?.boards?.[0] || null
  );
}
