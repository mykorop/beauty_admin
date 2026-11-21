# beauty_admin

Desktop web admin panel for the BookMe Platform Administrator. Angular 20 (standalone, zoneless,
signals + RxJS), Tailwind 4, PrimeNG, Amplify Auth against the existing Cognito pool. Talks only to
`admin-api` (`bookme-backend/services/admin-api`).

Domain vocabulary: `CONTEXT.md`. Decisions: `docs/adr/`. Specs and tickets: `.scratch/`.

## Commands

```bash
npm start                # dev environment, http://localhost:4200 (allowed by admin-api CORS)
npm run start:staging
npm run build            # development build
npm run build:staging / build:prod   # + source maps to Sentry when SENTRY_AUTH_TOKEN is set; no .map left
npm run typecheck        # app, unit specs and e2e
npm run test:ci          # Karma, headless
npm run e2e              # Playwright; starts `ng serve` in `e2e` on :4300 and `e2e-sentry` on :4301 itself
```

## Hosting

Upload the contents of `dist/beauty-admin/browser/` to the subdomain's document root,
including the hidden `.htaccess` file. Angular's existing `public/` asset configuration
copies `public/.htaccess` into every build. It serves `index.html` for client-side routes
such as `/login` and `/dashboard`, so direct links and browser reloads work.

Build it with `npm run build:prod` (or `build:staging`), not a bare `ng build`: the npm script is
what takes the source maps out of `dist` again (see Sentry).

Apache must enable `mod_rewrite` and allow these rules through `AllowOverride FileInfo`
(or `AllowOverride All`). If nginx serves the app without Apache, configure the equivalent
`try_files $uri $uri/ /index.html;` fallback in nginx instead.

## Environments

`src/environments/environment*.ts`, swapped by `fileReplacements` per build configuration
(`development`, `staging`, `production`, `e2e`, and `e2e-sentry` for the one Sentry spec). `dev`
and `staging` share one Cognito pool and one table on the backend, and the header indicator says
so. `adminApiUrl` is the HTTP API
endpoint of `admin-api` for that stage (`serverless info --stage <stage>`); it changes only if the
API is removed and redeployed. The prod `admin-api` allows no `localhost` origin, so a production
build works only from `https://admin.bookme.md`.

Every call to `admin-api` names the panel in `X-BookMe-Client: admin/<version> (web)`, the version
being `version` in `package.json`; the Журнал активності keeps it with each entry, so raise it when
a build is hosted to tell that build's requests from an older one's.

## Sentry

Errors of the panel go to its own Sentry project, in the organisation the backend and the mobile
apps report to, so a trace runs from the panel into `admin-api`. The set-up is
`src/app/core/monitoring/sentry.ts`; `main.ts`, `app.config.ts` and `AuthService` call into it.

- **DSN** — `sentry.dsn` in each `environment*.ts`. A DSN only lets a browser send events, so it is
  committed, not kept secret. Empty — as now, until the project exists — leaves Sentry off: no SDK
  set-up, no events, no trace headers. The `e2e` build keeps it empty; `e2e-sentry` points it at a
  made-up ingest that `e2e/sentry.spec.ts` answers itself.
- **Environment** — the build's stage (`dev`, `staging`, `prod`), as on the backend and in the apps.
- **What is reported** — whatever Angular's error handler sees, and every request that got no answer
  (offline, connection refused or timed out: status 0) or a 5xx, API Gateway's own 503/504 time-out
  included. A 4xx is the backend refusing on purpose and is not reported.
- **Who** — `user.id` is the admin's Cognito `sub`, read from the ID token once an admin session is
  found; signing out, by hand or by an expired session, clears it. No email or name of his is sent.
- **Traces** — `sentry-trace` and `baggage` go only to `adminApiUrl`, whose CORS allows them.

Source maps of `build:staging` and `build:prod` are hidden: the bundles do not reference them.
`scripts/sentry-sourcemaps.mjs` runs after either build. With `SENTRY_AUTH_TOKEN` set it injects
Sentry debug ids into the bundles and uploads the maps; it then deletes every `.map` from `dist`, so
none is hosted. Without the token the build ends as before, minus the maps. A failed upload fails
the build. Set these in the shell that builds, never in the repository:

| Variable            | Needed                                    | Meaning                                                   |
| ------------------- | ----------------------------------------- | --------------------------------------------------------- |
| `SENTRY_AUTH_TOKEN` | to upload                                 | Sentry auth token allowed to upload source maps — an organisation token is |
| `SENTRY_ORG`        | with a user token                         | organisation slug; an organisation token already carries it |
| `SENTRY_PROJECT`    | to upload                                 | slug of the panel's project                               |
| `SENTRY_URL`        | only if the token does not name a region  | e.g. `https://de.sentry.io` for the EU region             |

## Layout

```
src/app/core/auth/   Cognito sign-in (password → TOTP → role check), guard, session expiry
src/app/core/api/    the one interceptor for /admin/* (token, envelope, error codes) + typed clients
src/app/core/monitoring/  Sentry: options, error handler, failed-request reporting, admin id
src/app/i18n/        translation service, `t` pipe, uk / ru / ro dictionaries (key parity is tested)
src/app/shell/       sidebar + header; `nav-sections.ts` drives both the menu and the routes
src/app/pages/       screens
e2e/                 Playwright specs; `fixtures/` mock Cognito, admin-api and Sentry at the network level
scripts/             post-build step: source maps to Sentry, then out of `dist`
```

## Conventions

- A new backend `error.code` gets an `error.<CODE>` entry in all three dictionaries; without one the
  code itself is shown. A caller that words a code itself passes it in `SILENT_ERROR_CODES`.
- Clients return the payload, not the envelope: the interceptor has already unwrapped it.
- No component unit tests (see the spec): logic gets a Karma spec, screens get a Playwright spec.
- The admin account and its TOTP are set up by hand — this panel can only answer a TOTP challenge,
  not enrol a device. From `bookme-backend`: `bash tools/create-admin.sh` (what it does and why:
  `bookme-backend/project-constitution/playbooks/admin.md`).
