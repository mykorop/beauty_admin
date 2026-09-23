# Profiles, services and roster in BookMe style

Implements [ticket 02](../../.scratch/bookme-website-style/issues/02-profiles-services-roster.md)
on top of `8532f5a6c1fe9e1027329dde3b53e2d1d734af0d`.

The three profile lists, all four card frames, profile editors, service catalogues, master copies,
roster and invites use the existing BookMe palette and fonts. Shared field grids collapse on small
screens; tables keep all columns in local scroll containers. Brand-colour swatches remain profile
data. Existing APIs, routes, filters, permissions, validation and action payloads are unchanged.

Reason dialogs use the same theme across consumers. Initial focus lands on the reason, focus stays
inside the modal, and closing restores the trigger. Chaining Block → cancel upcoming preserves the
original page trigger. Conditional consumers also restore focus when destroyed; if a successful
action removes the trigger, focus returns to the workspace. Each textarea has a unique label ID,
including while one dialog replaces another. Busy actions keep confirmation, dismissal and cancel
unavailable, including Escape and backdrop clicks (dismissal checks the live busy state);
refusals retain the typed reason and use the existing toast. Toasts announce feedback without
autofocusing their close button; keyboard focus remains inside the modal during waiting and errors.

## Visual verification

Chromium on macOS, 2026-09-23. Compared with the website's
[orange-accent reference](../../../bookme_website/design/orange-accent/ro-1440-cta.png)
and `bookme_website/src/styles/global.css`. Captures use fixed mocked data and clock, loaded local
fonts, reduced motion and the Europe/Chisinau timezone. No live backend or credentials are used.

| Representative state                              | Capture                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| List, all profile statuses, open filter           | [1440px, uk](list-filter-1440.png), [390px, ro](list-filter-390.png) |
| Salon profile, including stored brand colour      | [1440px](profile-1440.png)                                           |
| Invalid profile form                              | [390px, ro](profile-invalid-390.png)                                 |
| Independent master editor                         | [768px, ru](master-form-768.png)                                     |
| Read-only client card                             | [390px, ro](client-390.png)                                          |
| Reason dialog and keyboard focus                  | [390px](reason-390.png), [720px](reason-720.png)                     |
| Reason action waiting / server refusal            | [Busy](reason-busy-390.png), [Error](reason-error-390.png)           |
| Service catalogue                                 | [1440px](catalogue-1440.png)                                         |
| Catalogue editor                                  | [1024px, ro](catalogue-form-1024.png)                                |
| Master copies, own values beside catalogue values | [1440px](copies-1440.png)                                            |
| Copy editor                                       | [768px, ru](copy-form-768.png)                                       |
| Roster and owner-master marker                    | [1440px](roster-1440.png)                                            |
| Invites and delivery failure                      | [1440px](invites-1440.png)                                           |

The browser checks cover all three lists, all four card types, each editor, services, copies, roster,
invites and dialogs at 1440, 1024, 768, 390 and 720 × 500 CSS px. Long names, addresses and emails
and uk/ru/ro labels are included. The 720 × 500 viewport models a 1440 × 1000 window at 200% zoom;
it is a layout-equivalent check, not OS magnification. Evidence captures are a selected subset.

Captures and overflow assertions use the unmodified application layout. On narrow screens,
full-page captures include the page's normal vertical flow; modal captures use viewport height. Reproduce with `npm run e2e -- e2e/profiles-style.spec.ts`; output is under
`test-results/profiles-style-*`.

## Contrast

[Calculated sRGB ratios](contrast.json) cover 68 relevant text/status/control combinations.
Normal text meets 4.5:1; control boundaries and focus meet 3:1. The primary accent keeps graphite
text; dangerous actions retain red. Tags also carry text, deleted rows use a separate background,
and active tabs carry both a border and weight. Disabled controls retain PrimeNG's disabled
semantics and opacity. Decorative dividers are not treated as control boundaries.

The preserved light tab bodies use a darker amber focus outline (`#92400e`); nested dark dialogs
keep the orange outline. Status tags and feedback ratios include their composited tinted surfaces.

## Staged compatibility

Document-level dark scope includes the three lists and profile/services/roster/invites routes.
All profile frames remain dark. Tab bodies assigned to tickets 03/04 retain explicit light colours
and native `color-scheme: light`, with local overflow; their body-mounted overlays follow the
light document scope. The reason dialog opts into its own dark scope. No global recolouring of
profile data, images, calendars or unconverted tables is applied. Ticket 05 removes these temporary
route scopes after the remaining sections are migrated.

## Validation

- Focused layout/accessibility checks: **17 passed**.
- `npm run typecheck`: passed.
- `npm run test:ci`: **204 passed**.
- `npm run build` (development): passed.
- `npm run e2e`: **257 passed**, including the 17 focused checks above.

## Standards

The independent review found no documented-standard or domain/ADR violations and no actionable
baseline smells. It identified a focus-return gap between chained dialogs; the implementation now
preserves the original page action and adds a browser regression for that sequence.

Recheck: “The focus fix resolves the reported chain: the second dialog inherits the original
profile action through `dialogOpeners`, and restoration waits until no other dialog remains.
The destruction callback covers conditional consumers, while the focusable `<main>` provides a
fallback when an action removes its trigger. Both added browser regressions exercise the relevant
user flows. No new hard standards violations or actionable baseline smells found.”

## Spec

The independent review identified conditional-dialog destruction bypassing focus restoration,
and low focus contrast within preserved light tabs. Both have dedicated browser coverage and
corresponding lifecycle/style fixes.

Recheck: “Both findings are resolved. Destruction-safe focus restoration covers conditional
consumers; chained dialogs preserve the original opener, with the focusable main region available
when the trigger disappears. Preserved light tabs use the darker focus outline, while dark reason
dialogs retain orange. The added browser checks explicitly cover this distinction and
conditional/chained focus return. No remaining spec issues identified in these fixes.”

A follow-up found that PrimeNG also retained its opening-time backdrop dismissal listener.
The visibility-change guard now checks the live busy state for every dismissal; keyboard Escape
is handled in the active reason dialog, even while a toast is above it. Busy focus moves from the
disabled submit button to the reason. The held-request check presses Escape, clicks the backdrop,
and verifies focus and the preserved reason after refusal. Recheck: “No remaining spec findings.
The additions keep focus within the busy/error dialog, preserve Escape dismissal afterward, and
prevent toast autofocus from disrupting that flow. The changes remain within the required modal,
busy-state, notification, and keyboard behavior.”

Review totals: **Standards 0 remaining (1 fixed); Spec 0 remaining (3 fixed)**.
The independent reviewers inspected source/tests; the implementation agent ran the checks above.
