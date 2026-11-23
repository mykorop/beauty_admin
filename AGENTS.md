# beauty_admin

## Compatibility

Every feature lands among old data and old code: the panel reads rows written by every earlier backend version, so their older shapes stay readable to it. The full rule (old data, old code, backfills): `beauty_salon_backend/CLAUDE.md`, «Compatibility».

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles with their default names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root, created lazily. See `docs/agents/domain.md`.
