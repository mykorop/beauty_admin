# Schedules and appointments in BookMe style

Implements [ticket 03](../../.scratch/bookme-website-style/issues/03-schedules-appointments.md)
on top of `3fa35ffcc30e28001c0f892466bdca7a51f8c7c1`.

Salon hours, independent and salon master schedules, rotation, absences, all four profile appointment
feeds and the general appointment section now use the website's graphite surfaces, warm text and
orange controls. The existing shared profile frame, table frame and reason dialog are reused.
Schedule calculations, timezone handling, routes, filters, sort order, payloads and action rules
are unchanged. Unmigrated reviews, media and history keep their staged light treatment.

Calendar cells retain the existing status words, reasons, appointment counts and salon boundaries.
Today has a filled date marker; custom hours and absences carry coloured top edges and their existing
text. Adjacent-month dates use dotted underlines instead of reducing text contrast. Tables and the
calendar scroll inside named, keyboard-focusable regions. Weekly fields and action rows wrap.

The reschedule dialog shares the reason dialog's frame, stays inside narrow/short viewports and
keeps focus inside while waiting or showing an error. Initial focus lands on the date; Escape and
backdrop dismissal respect the live busy state, and closing restores the opener. Available slots
have clear borders, the selected slot has a filled background and `aria-pressed`, unavailable slots
retain disabled semantics and booked slots keep their strike-through. Bulk cancellation keeps its
existing named-profile confirmation, required reason, separate action and authoritative result.

## Visual verification

Chromium on macOS. Compared with the website's
[orange-accent reference](../../../bookme_website/design/orange-accent/ro-1440-cta.png)
and `bookme_website/src/styles/global.css`. All captures use mocked data, a fixed
2026-09-23 clock, Europe/Chisinau timezone, loaded local fonts and reduced motion.

| State | Evidence |
| --- | --- |
| Calendar, today, all seven day statuses and appointment counts | [1440px, uk](calendar-1440.png) |
| Weekly hours and salon bounds | [390px, ro](hours-390.png) |
| Invalid weekly hours / backend refusal | [Invalid](hours-invalid-390.png), [Refusal](hours-refusal-390.png) |
| Rotation editor | [1024px, ro](rotation-1024.png) |
| Custom-hours absence editor | [768px, ru](time-off-768.png) |
| General appointments and status filter | [1440px, uk](appointments-1440.png) |
| Appointment details, services, price and actions | [1440px, uk](appointment-details-1440.png) |
| Rescheduling with selected and unavailable slots | [390px, ro](reschedule-390.png), [720px, uk](reschedule-720.png) |
| Reschedule waiting / refusal retaining the choice | [Busy](reschedule-busy-390.png), [Refusal](reschedule-refusal-390.png) |
| Bulk cancellation and partial result | [Confirmation](bulk-cancel-390.png), [Result](bulk-result-390.png) |

The focused browser scenarios cover 1440, 1024, 768 and 390 CSS px, plus 720 × 500 CSS px
(the layout viewport equivalent of a 1440 × 1000 desktop at 200% zoom). This checks layout reflow,
not OS magnification. Long Ukrainian, Russian and Romanian labels are included, with checks for
page/workspace overflow, modal bounds, Tab/Shift+Tab, Enter, Escape, focus return and horizontal
keyboard scrolling. Dense tables deliberately keep all columns in local scroll regions.
Native date/time controls use the browser's dark colour scheme; their browser-owned picker UI
is not part of the saved DOM captures.

Reproduce with `npm run e2e -- e2e/schedules-style.spec.ts`. Captures are written to
`test-results/schedules-style-*`. Calendar and rotation captures target their own visible regions
because the desktop workspace scrolls independently; other captures retain the normal page layout.
No layout is changed for screenshots. Evidence is a selected subset, not every language/width/state.

## Contrast

[Calculated sRGB ratios](contrast.json), reproduced by
`node design/bookme-style-03/check-contrast.mjs`, cover 42 relevant text, status, date/slot selection,
calendar indicator, focus and control-boundary combinations. Normal text meets 4.5:1; focus and
meaningful control boundaries meet 3:1. PrimeNG tags keep their existing meaning: booked/info,
completed/success, cancelled/secondary, no show/danger and manual/warning. Tinted tag backgrounds
are composited over the actual table, detail and stale-row surfaces. Shared controls and reason
dialogs also retain the [ticket 02 contrast verification](../bookme-style-02/contrast.json).
Disabled controls retain their existing semantics; decorative grid lines are not control boundaries.

## Validation

- `npm run typecheck`: passed (app, unit specs and e2e).
- `npm run build` and `npm run build:prod`: passed.
- `npm run test:ci`: **204 passed**.
- `npm run e2e`: **270 passed**, including all existing behavioral scenarios and 13 focused checks.
- After the final warning-wrap correction, all **13 focused checks** and both builds were rerun and passed.
- Contrast calculation: **42 combinations passed**.

The browser regressions first exposed the light calendar/appointment surfaces. The final content-width
assertion also failed before the stale warning was allowed to wrap; it now passes for all profile and
general appointment tables. No live backend, credentials or deployment were involved.

## Standards

Independent review: “No documented-standard violations or substantive new baseline smells found.”
The reviewer noted a possible specificity conflict between adjacent-month dates and today's badge.
The outside-month selector now explicitly excludes today, with a browser check for September 30
viewed in October. Browser reproduction did not confirm the original concern; the selector now
makes the intended precedence explicit.

Recheck: “Verified staged fix: `.calendar-date:not(.is-today)` removes the selector conflict.
The original issue was inferred from CSS specificity; browser reproduction did not confirm it.
Final Standards review: 0 documented violations, 0 substantive heuristic findings, 0 remaining
implementation findings.”

## Spec

Independent review: “All requested schedule and appointment views migrate; status semantics,
routes, API payloads, and business rules remain unchanged. Shared confirmations remain in use.
Local scrolling, responsive dialogs, keyboard focus, and busy/refusal states are covered.
No scope creep identified.”

The reviewer requested a refreshed check of native time input text. Recheck: “Both refreshed
390px hours screenshots show complete AM/PM values with no clipping. Calendar and rotation
captures are readable and show the intended states. Spec review: 0 unresolved findings.”

A final visual check found that the stale appointment warning inherited `white-space: nowrap`
from its date cell and overlapped the next column. Only that paragraph now wraps. The Spec reviewer
confirmed the change preserves date formatting and falls within the required readability scope;
the browser check asserts the warning's own content width as well as the page width.

Review totals: **Standards 0 remaining; Spec 0 remaining.** Reviewers inspected source and visual
evidence; the implementation agent ran the verification commands.
