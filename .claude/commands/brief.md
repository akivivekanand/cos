---
description: Morning brief. Read only, except one row into briefs.
---

# /brief

The morning ritual. Two minutes. READ ONLY except for inserting exactly one row into `briefs`. Nothing else in the database changes, no matter what the state looks like.

Read CLAUDE.md first.

## 0 · Preflight

Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set. If either is missing, say so plainly and stop.

Reads use both headers:

```
curl -s "$SUPABASE_URL/rest/v1/<table>?<query>" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY"
```

Never print the key. If a call fails, show the error plainly and stop. Never invent state.

## 1 · Read

- `daily_logs?select=*&order=log_date.desc&limit=3`
- `today?log_date=eq.<today>&select=*`
- `week?select=*&order=week_of.desc&limit=1`
- `projects?select=*&order=touched.asc`
- `decisions?select=*&order=decision_date.desc&limit=20`
- `flags?resolved_at=is.null&select=*&order=flag_date.asc`
- `signals?processed_at=is.null&select=id,lane,filename,created_at`
- `weekly_logs?select=*&order=week_of.desc&limit=1`

Compute two things before writing a word:

- **Staleness.** Is the most recent `daily_logs.log_date` the previous working day?
- **Unread.** Is the count of signals with `processed_at` null zero?

## 2 · Write the brief

Markdown, exactly these headings, in this order, nothing added and nothing dropped:

```
## Since <last log day>
## Today
## The week's arc
## Two moves
## Flags
## Trust
```

**Since `<last log day>`** · What actually happened, from the most recent daily log and any project touched since. Facts, not narration.

**Today** · The `today` row for this date: the schedule, and the hours split with `open` named. If no row exists for today, say that the last checkout did not set today and stop pretending otherwise.

**The week's arc** · The `week` row. If `set_at` is still `pending`, say the week was never set at closeout. Priorities with their percentages, and where the week stands against them.

**Two moves** · Two maximum. Fewer is fine. Each move cites a decision by date when one applies, in the form `(decided 2026-08-14)`. Choose by convergence, not coverage: the moves that make the rest of the week possible. A project untouched 10 or more working days is a candidate here and must be surfaced somewhere in the brief rather than dropped.

**Flags** · Open flags only, each with what it needs. If none are open, one line saying so.

**Trust** · `Nothing else moved.` appears here ONLY when every signal has been processed AND the last checkout was the previous working day. Otherwise state exactly what is missing: how many signals are unread, how many working days since the last checkout, whether the week was set. Honest degradation beats invented continuity.

The brief converges. It does not enumerate every project.

## 3 · Insert

`POST /rest/v1/briefs` with `{"md":"<the full brief>"}` plus `-H "Content-Type: application/json" -H "Prefer: return=representation"`.

One row. Nothing else. Show her the brief as rendered markdown and stop. No opener, no closing offer.
