---
description: Friday ritual. Synthesize the week and set the next one with its reasoning.
---

# /closeout

Friday, 4:30. Fifteen minutes. The second of the three moments state gets written, and the only one that sets a week.

Read CLAUDE.md first. The content law governs every line of this ritual.

## 0 · Preflight

Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set. If either is missing, say so plainly and stop.

Reads and writes as specified in CLAUDE.md. Never print the key. On any failed call, show the error plainly and stop.

## 1 · Read the week that happened

- `week?select=*&order=week_of.desc&limit=1`
- `daily_logs?log_date=gte.<this Monday>&select=*&order=log_date.asc`
- `decisions?decision_date=gte.<this Monday>&select=*&order=decision_date.asc`
- `flags?select=*&order=flag_date.asc`
- `projects?select=*&order=touched.asc`
- `signals?processed_at=is.null&select=*`

If signals are still unprocessed, process them here exactly as `/checkout` step 2 does: distill, show her, confirm, then null `content`, set `summary` and `processed_at`, delete any `inbox` object behind a `storage_path` and clear the field.

## 2 · Read the week back to her

Before setting anything, state plainly:

- Which priorities from the current `week` row landed, and at what honest percentage.
- Which projects moved and which did not. Name every project untouched 10 or more working days.
- Decisions made this week, by date.
- Flags opened and flags closed. Anything open more than a week gets named as open.
- Checkouts missed. If a working day has no daily log, say which.

No inflation. A week that did not go well reads as a week that did not go well.

## 3 · Set next week

Work through it with her, then write it.

**projects** · `PATCH /rest/v1/projects?slug=eq.<slug>` for each project whose `next_action`, `milestone`, `pct`, or `status` changes going into next week. Update `touched` only where the project actually moved, not because the closeout looked at it.

**decisions** · `POST /rest/v1/decisions` for every decision made in this session, `source` set to `closeout`, one sentence of `decision`, one or two of `why`. The reasoning is the point; next week's brief will cite these by date.

**flags** · Open what next week needs to carry. Close what this week resolved by setting `resolved_at`. Never delete.

**week** · `POST /rest/v1/week` for next Monday's `week_of`, or `PATCH /rest/v1/week?week_of=eq.<date>` if the row exists.

- `set_at`: the timestamp of this closeout, replacing `pending`.
- `priorities`: a jsonb array of `{"k":"P1","label":...,"pct":0,"note":...}`. Three or four maximum. `note` carries the reasoning, which is what makes the priority survive contact with Monday.
- `days`: a jsonb array of `{"label":"Mon","hours":<n>,"items":[...]}` for Mon through Fri, hours being the deep work realistically available against the known calendar.

## 4 · Synthesize

`POST /rest/v1/weekly_logs` with `week_of` set to this week's Monday and `body` as five lines: what moved, what did not, what was decided, what is open, what next week turns on.

## 5 · Show the ledger

End by showing her, in plain lines, every row created or changed: table, what it was, what it is now. Then stop.
