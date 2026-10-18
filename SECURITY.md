# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.x | Yes |
| < 1.0 | No |

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Report privately through GitHub's **Security → Advisories → Report a vulnerability**
flow, or email **ilyasaalmadani@gmail.com** with:

- a description of the issue and its impact,
- steps to reproduce or a proof of concept,
- the browser and operating system you used,
- any suggested fix, if you have one.

You can expect an initial acknowledgement within a few days. Please give the project a
reasonable amount of time to fix the issue before public disclosure.

## Scope

PATAB is a static, local-first web app. It has no backend, no accounts and no analytics.
Relevant classes of issues include:

- cross-site scripting through imported JSON, link titles, URLs or notes,
- bypassing `normalizeUrl()` to store a dangerous scheme,
- a Content Security Policy bypass,
- service-worker cache poisoning on a shared origin,
- leaking local data to a third party beyond the documented optional requests,
- dependency or build-script issues.

## Out of scope

- Self-hosted deployments that intentionally change the CSP or inject third-party code.
- Issues that require an already-compromised browser, extension or operating system.
- Missing hardening headers that cannot be set from a static host.
- Social engineering, spam or denial-of-service against GitHub Pages.

## Design notes

- User content is rendered with `textContent`, not `innerHTML`.
- Stored URLs are restricted to `http:` and `https:`.
- Imported state passes through `normalizeState()`; invalid tiles are dropped.
- The app ships with a strict CSP. There are no inline scripts and no `eval`.
- Network access is limited to optional favicons and Open-Meteo weather.
- There are no runtime dependencies.

Thank you for helping keep PATAB safe.
