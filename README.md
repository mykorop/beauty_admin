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
npm run build:staging / build:prod
npm run typecheck        # app, unit specs and e2e
npm run test:ci          # Karma, headless
npm run e2e              # Playwright; starts `ng serve --configuration e2e` on :4300 itself
```

## Environments

`src/environments/environment*.ts`, swapped by `fileReplacements` per build configuration
(`development`, `staging`, `production`, `e2e`). `dev` and `staging` share one Cognito pool and one
table on the backend, and the header indicator says so. `adminApiUrl` is the HTTP API
endpoint of `admin-api` for that stage (`serverless info --stage <stage>`); it changes only if the
API is removed and redeployed. The prod `admin-api` allows no `localhost` origin, so a production
build works only from `https://admin.bookme.md`.

## Layout

```
src/app/core/auth/   Cognito sign-in (password → TOTP → role check), guard, session expiry
src/app/core/api/    the one interceptor for /admin/* (token, envelope, error codes) + typed clients
src/app/i18n/        translation service, `t` pipe, uk / ru / ro dictionaries (key parity is tested)
src/app/shell/       sidebar + header; `nav-sections.ts` drives both the menu and the routes
src/app/pages/       screens
e2e/                 Playwright specs; `fixtures/` mock Cognito and admin-api at the network level
```

## Conventions

- A new backend `error.code` gets an `error.<CODE>` entry in all three dictionaries; without one the
  code itself is shown. A caller that words a code itself passes it in `SILENT_ERROR_CODES`.
- Clients return the payload, not the envelope: the interceptor has already unwrapped it.
- No component unit tests (see the spec): logic gets a Karma spec, screens get a Playwright spec.
- The admin account and its TOTP are set up by hand — this panel can only answer a TOTP challenge,
  not enrol a device. From `bookme-backend`: `bash tools/create-admin.sh` (what it does and why:
  `bookme-backend/project-constitution/playbooks/admin.md`).
