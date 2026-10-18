# Changelog

All notable changes to PATAB are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-10-19

### Added

- Local-first dashboard with live clock, date, greeting and optional weather.
- Hero search across every board and folder, with fuzzy matching and web bangs
  (`!g`, `!ddg`, `!yt`, `!gh`, `!w`, `!npm`, `!maps`, `!b`).
- Command palette (`⌘K` / `Ctrl K`) with keyboard navigation and quick actions.
- Multiple boards, each with its own links, folders, notes and tasks.
- Folder tiles with a two-by-two favicon preview and a folder view.
- Drag-and-drop tile reordering, plus `Alt + ←/→` for keyboard users.
- Autosaving scratchpad with word and character counts.
- Task list with progress bar, inline add, completion and cleanup.
- Focus timer with 25/50/15 minute presets, progress ring and live title countdown.
- Five accent colors, dark/light/system themes, and aurora/grid/plain backgrounds.
- Settings drawer with weather city search, site-icon toggle, storage stats and board
  management.
- One-click JSON export and import with validation and confirmation.
- Installable PWA with an offline app-shell service worker.
- Responsive layout, reduced-motion support and accessible dialogs.
- Strict Content Security Policy, URL scheme validation and `textContent` rendering.
- Unit tests for the state layer, a static integrity check, and an optional Playwright
  smoke test.
- MIT license, contribution guide, code of conduct, privacy and security documentation.
- README with real screenshots, social preview and a live demo on GitHub Pages.
- Lighthouse mobile audit: 98 performance, 100 accessibility, 100 best practices,
  100 SEO.

### Security

- Rejects `javascript:`, `data:` and other non-HTTP(S) URLs.
- Normalizes imported state and drops malformed boards, links and tasks.
- Optional external requests are limited to favicons and Open-Meteo weather.
