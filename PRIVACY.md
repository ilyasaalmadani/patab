# Privacy

PATAB is designed to be local-first. This document describes exactly what is stored,
what leaves your browser, and how to remove it.

## What PATAB stores

Everything is stored in your browser's `localStorage` for the site where PATAB is
hosted. Nothing is sent to a PATAB server because there is no PATAB server.

| Key | Contents |
| --- | --- |
| `patab:state:v1` | Boards, links, folders, notes, tasks, settings, recent links, timestamps |
| `patab:weather:v1` | A cached weather reading and the time it was fetched |

The app has no cookies, no fingerprinting, no analytics and no advertising.

## Optional network requests

PATAB works offline once loaded, but two optional features use the network:

### Site icons

When **Site icons** is on (the default), PATAB requests a favicon for each saved domain
from `https://www.google.com/s2/favicons`. This reveals the domains you saved to Google,
but not your notes, tasks or browsing activity. Turn it off in **Settings → Privacy &
data → Site icons** for a fully local, monogram-only experience.

### Weather

Weather is off by default. If you enable it, PATAB requests:

- your coordinates from the browser's geolocation API, or a city you type,
- a city lookup from `https://geocoding-api.open-meteo.com`,
- the current weather from `https://api.open-meteo.com`.

The resulting reading is cached locally for 30 minutes. Open-Meteo receives the
coordinates or city you choose. PATAB does not send your notes, tasks or links.

### Hosting

The app itself is served by whichever static host you use (GitHub Pages by default).
That host can see standard request metadata such as your IP address and user agent,
just like any website. PATAB does not add analytics on top of that.

## Backups

**Settings → Privacy & data → Export** creates a JSON file containing your boards,
links, notes and tasks. Treat it like a personal document. **Import** replaces the
current state after a confirmation prompt.

## Clearing your data

Use **Settings → Reset all data** to remove PATAB state from this browser. You can also
clear site data through your browser settings, or remove the `patab:state:v1` and
`patab:weather:v1` keys from `localStorage`.

## Children

PATAB is a general-purpose productivity tool and does not knowingly collect personal
information from anyone. Because there is no account or server, the project has no
personal data to collect.

## Changes

If a future version adds an optional network feature, it will be documented here and in
the README before release.

Questions? Open an issue or email **ilyasaalmadani@gmail.com**.
