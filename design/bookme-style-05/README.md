# Complete BookMe theme verification

Ticket: [05 — complete theme verification](../../.scratch/bookme-website-style/issues/05-complete-theme-verification.md).
Implementation baseline: `ca3ff7e12d9074f60b2b4d4bea1c9f8c6356a8e8`.

The document declares the dark theme before Angular starts. Its canvas, native controls,
PrimeNG components and body-mounted overlays now share that theme on every route. The router
subscription, migration allowlist, local theme markers, light profile fallback and light branches
in the custom preset have been removed. The remaining tab placeholder also uses semantic text.

The Angular/PrimeNG/Tailwind versions, API calls, domain rules, routes, uk/ru/ro translations,
profile colours, chart series, images, local fonts, font licences and favicon are preserved.
Only beauty_admin is changed; its build uses its own assets.

## Browser and capture conditions

Verified on 2026-09-23 with Chromium **153.0.8010.12**, Playwright **1.63.0**, macOS **26.6.2**,
Node **24.20.0** and npm **11.19.0**. All browser scenarios use the existing Cognito/admin-api
mocks, including password and TOTP through the real form. Unmatched API requests fail the tests.

Visual captures freeze time at **2026-09-23 09:00 UTC**, use **Europe/Chisinau**, wait for
`document.fonts.ready` and disable animations. Fixtures include long names, addresses, email,
unbroken audit/review text, Romanian diacritics and Ukrainian/Russian Cyrillic. The main matrix is
1440 × 1000 / uk, 1024 × 900 / ro, 768 × 1000 / ru and 390 × 844 / ro. Login also has uk and ru
captures; the dashboard, forms, tables and dialogs run through all four sizes.

The existing 720 × 500 / uk cases exercise the layout viewport equivalent of 200% zoom on a
1440 × 1000 content area. An additional check applies **native Chromium tab zoom of 2** through
a temporary extension in an isolated test profile: a 1440px window yields a 720 × 456 CSS-pixel
viewport and device pixel ratio 2. Sign-in, TOTP, statistics, menu activation, Escape and focus
return pass at this real browser zoom. No installed browser profile is changed.

Screenshots retain the normal viewport and local scrolling except the existing full-dashboard
captures, which temporarily expand the workspace to show all sections. The shell overview,
native zoom, calendar, dialogs and table captures retain normal layout. These are inspection
artifacts, not automatically accepted pixel baselines.

## Coverage against the parent specification

The full regression suite exercises every area below. Fresh representative captures cover shared
components and unique views without multiplying every route by every language and width.

| Area | Views and behavior checked | Representative evidence |
| --- | --- | --- |
| Login | Password, TOTP, invalid input/code, uk/ru/ro, access refusal, sign-out/re-entry, expired session return URL | [uk 1440](login-uk-1440.png), [ru 768](login-ru-768.png), [ro 390](login-ro-390.png), [TOTP](login-totp-390.png), [error](login-error-390.png) |
| Shell and dashboard | All navigation entries, current section, environment/email/language, basic and loaded detailed statistics, chart tooltip/table, failure, mobile menu | [shell](shell-overview.png), [1024](dashboard-ro-1024.png), [768](dashboard-ru-768.png), [390](dashboard-ro-390.png), [chart table](chart-table.png), [native 200%](native-zoom-200.png) |
| Three profile lists | Salons, independent masters, clients; active/blocked/deleted, search, filters, sorting, paging, URL/back state | [1440 filter](list-filter-1440.png), [390 filter](list-filter-390.png) |
| Salon card | Profile/edit, hours, roster, catalogue, appointments, reviews, media, invites, history; every tab address | [profile](profile-1440.png), [invalid form](profile-invalid-390.png), [catalogue form](catalogue-form-1024.png), [roster](roster-1440.png), [invites](invites-1440.png) |
| Independent master card | Profile/edit, schedule, catalogue, appointments, reviews, media, history; previous salon and salon-master redirect | [master form](master-form-768.png), [media](master-media-768.png); existing master-card/master-catalog-schedule scenarios |
| Salon master card | Profile/edit, working schedule, master copies, appointments, reviews; owner and deleted-salon restrictions | [copy form](copy-form-768.png), [hours editor](hours-390.png), [invalid hours](hours-invalid-390.png), [calendar](calendar-1440.png), [rotation](rotation-1024.png), [absence](time-off-768.png) |
| Client card | Read-only profile, appointments across venues, reviews, history, blocking/unblocking | [profile](client-390.png), [shared history](history-390.png); existing clients scenarios |
| General appointments | Platform day and profile filters, details, statuses, rescheduling and bulk cancellation | [table](appointments-1440.png), [reschedule](reschedule-390.png), [bulk cancellation](bulk-cancel-390.png) |
| General reviews | Visible/hidden labels, long text, filters, appointment reference, hide/restore and required reason | [table](reviews-1440.png), [confirmation at 200% layout](review-dialog-720.png) |
| Profile media | Salon and independent-master gallery/avatar/certificates, whole previews, missing resources, irreversible confirmation | [desktop](media-1440.png), [390](media-390.png), [certificate](certificate-1440.png), [refusal](media-dialog-refusal-390.png) |
| Audit and profile history | General filters, expansion, before/after values, paging; salon/master/client histories | [expanded log](audit-details-1440.png), [1024 filter](audit-filter-1024.png), [390 history](history-390.png) |
| Shared controls | Fields, selects, calendars, reason/reschedule dialogs, busy/refusal states, toast outside the shell | [reason at 200% layout](reason-720.png), [sign-in toast](toast-sign-in.png), [reschedule](reschedule-390.png) |

The existing behavioral files cover save/cancel, conflict/retry, deleted profiles, required reasons,
double-submission prevention, keyboard selection, routes, filters and returning to lists. The style
files reuse those public browser seams for overflow, colour, focus and visual evidence. New scenarios
only cover the initial unbooted canvas under both system preferences and native 200% browser zoom.
Existing login/session tests now also observe the resulting theme; sign-out waits for the departing
screen to leave the DOM before inspecting the login screen.

## Visual comparison and accessibility

All 42 retained screenshots were visually inspected. No unintended light surface, overlapping action
or missing glyph was found. Local table/calendar clipping represents scrollable content; the tests
exercise that scrolling. A cropped native-zoom capture was replaced with the complete Chromium
viewport before inspection.

Reference: the current website at `b79b8b835a6eb233138b9de550c3f772fc641b6f`, its
[graphite/orange CTA](../../../bookme_website/design/orange-accent/ro-1440-cta.png),
[palette](../../../bookme_website/src/styles/global.css) and brand navigation. The panel retains
the same #181A1D canvas, #1E2024 / #25282D surfaces, warm #F5F2EB text, #B9B9C0 secondary text,
#F59E0C primary accent and dark button text. Instrument Serif is limited to BookMe with its orange
dot; dense operational content uses sans-serif. Romanian uses local DM Sans; uk/ru explicitly use
the system Cyrillic-capable stack. The admin's tighter spacing and smaller titles suit tables/forms.

Keyboard checks cover Tab and Shift+Tab inside reason/reschedule dialogs, named inputs and OTP,
Enter/Space activation, selects and Escape, menu focus return, modal opener restoration after
cancel/success, focus after a removed trigger, and local table/calendar keyboard scrolling. Focus
rings are visible and separated from controls. Busy dialogs retain focus and prevent dismissal.
Reduced-motion scenarios disable optional animation. Status words, active-tab underline/border,
selected-slot shape/pressed state, chart legends/tooltips and equivalent data tables preserve meaning
beyond colour. Long text wraps; dense columns remain inside local scroll regions.

[Current core contrast calculations](contrast.json) cover 24 foreground/surface pairs. Normal text
is 13.23–15.60:1, secondary text 7.58–8.94:1, accent/focus 6.89–8.12:1 and input boundaries
4.22–4.97:1. Hover and pressed accent text stay at least 5.37:1. Thus normal text exceeds 4.5:1,
large text exceeds 3:1, and focus/control boundaries exceed 3:1. The existing scripts were rerun:
[42 schedule/appointment combinations](../bookme-style-03/contrast.json) and
[29 moderation combinations](../bookme-style-04/contrast.json) pass, including composited status
tints and destructive controls. Decorative separators and disabled controls are not counted as
active control boundaries. Loaded images and the profile's #aa3366 colour remain data, not UI tokens.

Native date/time fields inherit the dark colour scheme. Browser-owned picker popups, other browser
engines, screen-reader sessions and OS magnification were not inspected; the scope uses Chromium
and actual browser zoom plus the responsive/reflow matrix.

## Command results

- `npm run typecheck`: passed for app, unit and e2e TypeScript.
- `npm run build`: passed; initial development bundle 2.51 MB.
- `npm run build:prod`: passed; initial bundle 987.81 kB, estimated transfer 199.27 kB, within budgets.
- `npm run test:ci`: **204 passed**.
- Focused login/profile/schedule/moderation suite: **55 passed**.
- Native zoom check: **1 passed**; initial-document red/green confirmed both system preferences.
- `node design/bookme-style-03/check-contrast.mjs`: **42 combinations passed**.
- `node design/bookme-style-04/check-contrast.mjs`: **29 combinations passed**.
- Full `npm run e2e`: **290 passed in 4.2 minutes**, no failures or skips; [complete output](playwright-results.txt).
- After the native zoom screenshot correction and table-toggle check, that scenario passed again (1/1); application code was unchanged.

The sandbox initially blocked the Angular listening socket and aborted a build (exit 134). Both
operations passed when rerun with the required execution permission. During focused test preparation,
a sign-out assertion raced the old/new screen overlap and the zoom browser inherited an incompatible
device-scale option. Both test setup issues were corrected before the full run.

Reproduce the screenshots with:

```sh
npm run e2e -- e2e/bookme-style.spec.ts e2e/profiles-style.spec.ts e2e/schedules-style.spec.ts e2e/moderation-style.spec.ts e2e/shell.spec.ts
```

Images are written to `test-results/`; the selected final captures are saved beside this report.

## Standards

Independent reviewer: “Final Standards count: **0 findings**. Rechecked the zoom test additions,
finalized report, 42-image inventory, full Playwright output, and ticket checklist/comment.
No documented-standard violations or substantive baseline smells introduced.”

## Spec

Independent reviewer: “No Spec findings. The diff implements ticket 05’s permanent document-level
dark theme and removes migration scopes without changing API, routes, business rules, languages,
dependencies or assets. New tests cover externally visible behavior. The completed report documents
the required coverage, 42 screenshots, accessibility and contrast checks, actual 200% browser zoom,
and verification limits. All report links resolve; retained Playwright output confirms **290 passed**.
Representative screenshots inspected during review show no unintended light surfaces or obscured
controls.”

Review totals: **Standards 0; Spec 0.**
