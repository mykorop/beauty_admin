# Sign-in, navigation and dashboard in BookMe style

Implements [ticket 01](../../.scratch/bookme-website-style/issues/01-sign-in-navigation-dashboard.md),
starting from `788ec4fc605fa57d570046781ef0040f0a3d83b7`.

The password/TOTP flow, shell and complete dashboard now use the website's graphite surfaces,
orange actions and Instrument Serif wordmark. DM Sans is bundled for Romanian; Ukrainian and
Russian explicitly use the system's Cyrillic sans-serif. Font files, their OFL licenses and the
existing website favicon are copied into `public/`, with no sibling-repository build dependency
or font-service requests.

## Visual verification

Reviewed on 2026-09-23 in Playwright Chromium on macOS against the website's
[orange-accent reference](../../../bookme_website/design/orange-accent/en-1440-cta.png)
and its `src/styles/global.css` palette. Screenshots use local loaded fonts, reduced motion,
fixed mocked data/dates and the Europe/Chisinau browser timezone. The existing date/calculation
logic remains unchanged.

| Representative screen | Capture |
| --- | --- |
| Password, desktop | [1440px](login-password-1440.png) |
| Invalid email and keyboard focus | [390px](login-password-invalid-390.png) |
| TOTP | [390px](login-totp-390.png) |
| Wrong TOTP with retry | [390px](login-error-390.png) |
| Shell and basic figures | [Desktop overview](shell-overview.png) |
| Complete dashboard, Ukrainian | [1440px](dashboard-uk-1440.png) |
| Complete dashboard, Romanian | [1024px](dashboard-ro-1024.png), [390px](dashboard-ro-390.png) |
| Complete dashboard, Russian | [768px](dashboard-ru-768.png) |
| 200% zoom layout equivalent | [720 × 500 CSS-pixel viewport](dashboard-uk-720.png) |
| Expanded navigation | [390px](navigation-390.png), [768px](navigation-768.png), [720px](navigation-720.png) |
| Chart keyboard focus and tooltip | [Appointments](chart-tooltip.png) |
| Same chart as a table | [Appointments table](chart-table.png) |
| Basic-load failure and previous detailed result | [Failure](dashboard-failure.png) |

Full dashboard captures temporarily expand the workspace's vertical scroll container so the
whole result is visible in one image. The shell overview, navigation and chart captures use
the normal layout. Overflow assertions run against the normal layout before capture.
The 720 × 500 check models the layout viewport of a 1440 × 1000 window at 200% zoom; this is a
browser layout check, not an OS zoom or assistive-technology session.

The narrow menu opens with Enter/Space, follows normal Tab order, closes on Escape or route
selection, and returns focus to its button. It expands in document flow. Active navigation has
`aria-current="page"`, bold text and an orange left border. Counter links have borders/arrows;
non-link counters have neither. Long period/attention filters wrap, and the attention table
scrolls locally. Chart tooltips stay within the chart width, retain keyboard point navigation,
and announce their values. Previous results keep full text contrast while a calculation runs.

## Contrast

[Calculated sRGB ratios](contrast.json) cover text, all accent states, control boundaries and
all five unchanged chart colors against each graphite surface:

- Main text: **13.23–15.60:1**; secondary text: **7.58–8.94:1**.
- Accent text/focus: **6.89–8.12:1**; hover: **8.38–9.88:1**; active: **5.37–6.33:1**.
- Graphite text on the filled primary action: **8.12:1** (hover **9.88:1**, active **6.33:1**).
- Input/action boundaries: **4.22–4.97:1**. Focus uses a separate 3px outline.
- Chart series: minimum **3.35:1**. Axes/labels use the control/secondary tokens. Recessive grid
  lines and decorative card dividers use the website's border token.

Aura's dark error/info/success/warning text is lightened to its 300 shades for readable feedback
on tinted surfaces. Disabled actions retain PrimeNG's disabled semantics and opacity. Selected
navigation/options add a border, weight or underline; their distinction is not color alone.

## Staged compatibility

`BookMePreset` extends the installed Aura preset. `App` applies `.bookme-dark` at the document
root only on `/login` and `/dashboard`, so body-mounted toast/popover content follows the page.
The sidebar and header carry their own dark scope on all routes; the language popup inherits
that scope. Other pages and their body-mounted controls retain light Aura. This temporary route
scope, light tokens and workspace fallback are to be removed in ticket 05. There is no theme
switch, and OS light/dark preference does not select the admin theme.

## Validation

- Focused sign-in/shell: 13 passed; basic/detailed dashboard: 18 passed.
- Responsive/visual checks: 7 passed; chart geometry: 8 passed.
- `npm run typecheck`: passed.
- `npm run build`: development build passed.
- `npm run test:ci`: **204 passed**.
- Full `npm run e2e`: **240 passed** (3.2 minutes), including legacy sections.

Reproduce visual evidence with `npm run e2e -- e2e/bookme-style.spec.ts`; captures are written
under `test-results/bookme-style-*`. The new behavioral test covers the missing narrow menu
flow. Detailed statistics use the existing fixture, extracted once for reuse by capture checks.
All Cognito and admin-api calls are intercepted; no production data or credentials are used.

## Standards

No findings. Changes preserve `CONTEXT.md` terminology and the on-demand statistics behavior
required by ADR 0003. No documented-standard violations or actionable baseline smell regressions.
Theme tokens and the shared detailed-statistics fixture are centralized; staged compatibility
is explicitly documented for removal.

## Spec

No missing, incorrectly implemented, or out-of-scope requirements found. The scoped theme,
local fonts, navigation/focus, login states and complete dashboard presentation match ticket 01.
Routes, calculations and chart values remain intact; inspected captures show readable narrow
navigation, dashboard content and chart tooltips.

Independent review totals: **Standards 0; Spec 0**.
