# Reviews, profile media and audit history in BookMe style

Implements [ticket 04](../../.scratch/bookme-website-style/issues/04-reviews-media-audit.md)
from `d90257103643761c1cd0f17f240789de3850a9e7`.

General reviews and all four profile review tabs now share graphite tables, warm text, readable
filters and local keyboard scrolling. Visible/hidden labels remain explicit. The existing appointment
ID appears beneath the author; text, scores, ordering, filters and moderation contracts are preserved.

Salon and independent-master media use matching cards. Gallery photos and certificate scans show
the whole image without colour filters; avatars keep their existing circular crop. Failed previews
show a localized label while retaining the original resource link. Certificate details wrap, and
removal still uses the shared irreversible-action dialog with the existing required reason.

The general audit log and salon, independent-master and client histories share the same surfaces.
Before/after columns keep their text headings and scroll locally. Loading, failure and empty states
are styled consistently. API calls, cursors, timestamps, permissions, notification contracts and
business rules are unchanged.

## Visual verification

Compared in Chromium on macOS with the website's
[orange-accent reference](../../../bookme_website/design/orange-accent/ro-1440-cta.png)
and `bookme_website/src/styles/global.css`. All images are mocked SVG fixtures; deletion requests
are answered by the existing admin-api mock. No live files are deleted.

Captures use a fixed 2026-09-23 clock, loaded local fonts and reduced motion. The representative
matrix is 1440px/uk, 1024px/ro, 768px/ru, 390px/ro and 720 × 500px/uk. The last is the layout
viewport equivalent of a 1440 × 1000 desktop at 200% browser zoom; OS magnification was not tested.
Dense tables deliberately retain every column inside named, keyboard-focusable scroll regions.
Native date-picker popups are browser-owned and are not included in these screenshots.

| State | Evidence |
| --- | --- |
| Visible and hidden reviews, long text, author and appointment | [1440px](reviews-1440.png) |
| Narrow review filter and review confirmation | [390px](review-filter-390.png), [200% layout](review-dialog-720.png) |
| Gallery, certificate and missing scan | [1440px](media-1440.png), [390px](media-390.png), [certificate](certificate-1440.png) |
| Independent-master avatar and media | [768px](master-media-768.png) |
| Irreversible deletion confirmation | [1440px](media-dialog-1440.png), [200% layout](media-dialog-720.png) |
| Busy deletion and refusal retaining the reason | [Busy](media-dialog-busy-390.png), [Refusal](media-dialog-refusal-390.png) |
| Unavailable resource, failed read and empty history | [Resource](media-unavailable-390.png), [Failure](media-failed-390.png), [Empty](history-empty-390.png) |
| Filtered audit log, expanded before/after values and focus | [1440px](audit-details-1440.png), [open filter at 1024px](audit-filter-1024.png) |
| Profile history with long author and values | [1440px](history-1440.png), [390px](history-390.png) |

The focused browser checks cover page/workspace overflow, individual review cell overflow, filter
popups, Tab/Shift+Tab confinement, Enter/Escape, visible focus, keyboard scrolling, focus return
after cancellation and successful removal, busy states, preserved input on refusal, original image
sources and existing retry behavior. Existing behavioral suites cover hiding/restoring reviews,
required/optional reasons, certificate-and-scan deletion, deleted profiles, paging and audit details.

Visual inspection caught a table selector affecting nested audit columns and a review date extending
past its cell. The final selectors and date width correct both. Screenshot evidence is a selected
subset, not a pixel-baseline suite or every language/width/state combination.

Reproduce with `npm run e2e -- e2e/moderation-style.spec.ts`. Screenshots are written to
`test-results/moderation-style-*`; the selected final images are saved here. The certificate capture
targets its card because desktop workspaces scroll independently of the page.

## Contrast

`node design/bookme-style-04/check-contrast.mjs` verifies [29 colour combinations](contrast.json).
Normal text meets 4.5:1; focus and meaningful control boundaries meet 3:1. Visible/hidden tags use
the existing success/warning roles and explicit words. Hidden-review tint is included in the
calculation. Shared reason dialogs and feedback retain the
[ticket 02 contrast checks](../bookme-style-02/contrast.json). Decorative separators and disabled
controls are not treated as active control boundaries.

## Validation

- Typecheck passed for the app, unit specs and browser specs.
- Development and production builds passed.
- Unit suite: 204 passed.
- Focused ticket browser checks: 17 passed.
- Full Playwright run: 282 passed; 5 old staged-migration assertions still expected the audit log
  to be light. Those expectations were updated to graphite, and the complete affected file passed
  on rerun (7/7). All 287 browser scenarios are verified; the full suite was not repeated after this
  test-only correction.
- Standards and spec reviews: no findings.

## Standards

Independent reviewer: “No documented-rule violations, substantive code smells, or confirmed
regressions in the staged changes, including the updated `e2e/bookme-style.spec.ts` expectations.
The implementation follows existing shared-component, translation, theme-token, and CSS-layer
conventions. Domain rules and API boundaries remain unchanged.”

## Spec

Independent reviewer: “The staged implementation matches ticket 04: all required reviews, media,
audit and history views use the shared theme; appointment references, long text, image fallbacks
and existing moderation contracts are preserved. Representative screenshots support the readability
and responsive-layout requirements. The updated audit-theme test expectation is consistent with
the migration. No missing requirements, incorrect implementations or scope creep identified.”

Review totals: **Standards 0; Spec 0.**
