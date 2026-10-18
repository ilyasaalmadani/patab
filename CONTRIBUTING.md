# Contributing to PATAB

Thank you for taking the time to contribute. PATAB is a small project with a strong
point of view: calm, local-first, readable and dependency-free. Contributions that
respect that philosophy are very welcome.

## Good first contributions

- Accessibility fixes: focus order, screen-reader labels, contrast, keyboard paths.
- Small visual polish that does not add weight.
- Bug fixes with a clear reproduction.
- Translations and documentation improvements.
- Performance wins in rendering or search.

For large features, open an issue first so we can agree on scope before you spend time
on a pull request.

## Setup

Requirements: Node.js 20+ and a modern browser.

```bash
git clone https://github.com/ilyasaalmadani/patab.git
cd patab
npm run dev
```

There is no build step and nothing to install to run the app. Open
<http://localhost:4173>.

For screenshots or the optional browser smoke test:

```bash
npm install
npm run test:e2e
npm run screenshots
```

`playwright-core` is a development-only dependency. It uses your installed Google
Chrome; no browser download is required.

## Project layout

```text
index.html              app shell and accessible markup
assets/core.js          pure state model, validation, fuzzy search, bangs
assets/app.js           UI shell and event handling
assets/app.css          design system and responsive layout
sw.js                   offline app-shell cache
tests/core.test.mjs     unit tests for the state layer
scripts/dev.mjs         zero-dependency static server
scripts/check.mjs       local-reference and license check
scripts/screenshots.mjs real-browser screenshots
scripts/e2e.mjs         optional Playwright smoke test
```

## Code guidelines

- Keep the app framework-free and build-free.
- No new runtime dependencies without a very good reason.
- Put pure logic in `assets/core.js` so it can be unit-tested with `node --test`.
- Never render user content with `innerHTML`. Use `textContent` and DOM APIs.
- Only `http:` and `https:` URLs may be stored. `normalizeUrl()` is the gatekeeper.
- Prefer native platform features: `<dialog>`, CSS grid, `Intl`, service workers.
- Keep the UI accessible: keyboard reachable, visible focus, sensible ARIA, and no
  motion that ignores `prefers-reduced-motion`.
- Preserve the visual language: restrained color, generous spacing, soft glass panels,
  one accent, no clutter.

## Tests

Before opening a pull request:

```bash
npm test
npm run check
```

If you changed the UI, also run the smoke test and regenerate screenshots when the
visuals changed:

```bash
npm run test:e2e
npm run screenshots
```

The screenshot script writes to `docs/` and `docs/screenshots/`. Compress large PNGs if
possible, but keep text crisp.

## Commit messages

Use a short, imperative subject. Conventional prefixes are appreciated:

```text
feat: add folder drag targets
fix: keep note caret when switching boards
docs: clarify weather privacy
chore: bump playwright-core
```

Keep commits focused. A pull request that mixes a refactor with a visual redesign is
hard to review.

## Pull request checklist

- [ ] `npm test` passes.
- [ ] `npm run check` passes.
- [ ] The change works with a keyboard and at 390px width.
- [ ] No user content is injected through `innerHTML`.
- [ ] No new runtime dependency, tracking or account requirement.
- [ ] Screenshots are updated if the UI changed.
- [ ] The PR description explains the problem, the approach and how it was tested.

## Reporting bugs

Open an issue with the bug template. Include the browser and OS, exact steps, expected
behavior, actual behavior, and a screenshot or console message if relevant. Remove any
personal data from screenshots and backups before attaching them.

## Code of conduct

By participating, you agree to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
Be kind, assume good intent, and keep the discussion focused on making the project
better.
