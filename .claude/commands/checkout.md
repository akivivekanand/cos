# /checkout · end of day, the only routine write moment

Follow CLAUDE.md's content law, table contracts, and connection rules throughout. Steps, in order:

0. PREFLIGHT: confirm `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are both set. If either is missing, say so plainly, name the setup step (Claude Code environment settings), and stop. On any failed call, show the error plainly and stop. Never fabricate state.
1. READ current state: latest `week` row, open `flags`, all `projects`, today's `daily_logs` row if it exists, and every `signals` row where processed_at is null.
2. PROCESS each unprocessed signal:
   - Calendar (project_slug 'calendar', or calendar-shaped content: day headers like "Tuesday, August 18" with timed events): parse into one row per date. Classify each event: titles containing Break are kind break; advising appointments are advising; review, deadline, prep, and focus blocks are deep; 1:1s, check-ins, team meetings, and retreats are meeting. Compute hours per date: deep, meetings, advising sums from durations; open = 8 minus those three, floored at 0; breaks excluded from all three. Ignore snapshot or summary prose in the export. Show her the parse (dates, event counts, hours), and after she confirms, UPSERT all rows in one call: POST "$SUPABASE_URL/rest/v1/today?on_conflict=log_date" with header "Prefer: resolution=merge-duplicates,return=representation" and a JSON array body. Last paste wins per date; unmentioned dates are untouched. Then set processed_at, write a summary like "Calendar upsert: N dates, <range>", null content. If she says "process my calendar signals" in any session, run exactly this, immediately, as a direct instruction.
   - Tagged (project_slug set, any other value): this is an update-lane entry for that project. Draft the row changes it implies (status, next_action, pct, touched from the signal's date) plus a summary; when the update is already concise and people-safe, the summary is the text as written. Show her, and after she confirms, apply the project row changes, set processed_at, write summary, null content.
   - Untagged: extract what changed from inventories and pasted notes; distill transcripts and meeting summaries to decisions, action items, and dates, show her each distillation, and after she confirms, set processed_at, write summary, null content, and delete any storage object referenced.
   - Out of scope, ahead of all three branches: a signal crossing the content law (promotion, compensation, job search, career strategy, portfolio, personal projects) never enters state. Do not distill it into any row. Set processed_at, write summary "Out of scope for this system", null content, delete any storage object behind it, and tell her.
3. ASK exactly three questions, one message, nothing else:
   - What moved today that I can't see in the signals?
   - Any decisions or priority changes? (each one gets a Why)
   - What does tomorrow look like? (paste calendar if handy, or skip)
4. UPDATE state per the contracts: project rows (status, next_action, pct, touched), week priorities pct, flags (insert new, resolve done), decisions rows with Why, tomorrow's `today` row from the pasted calendar.
5. CHECKLIST: read today's checklist_items. Her dashboard taps stand as
   written. For each row still open, ask carried or dropped in the same
   message as anything else outstanding; default carried. Carried: set
   today's row to carried and insert an open row for the next working day
   with carried_from set to today. Dropped is never auto-assigned.
   Then pull the Notion Tasks database per the Notion read law: status is
   not Done, Owner contains Aki, Due on or before the next working day,
   Project limited to the allowlist inside the query filter itself. Show
   the pull as proposed seed rows next to the carries: title, due, project,
   one line each. She confirms, edits, or strikes in one message; only
   confirmed rows are inserted, with source_url set to the Notion row and
   slugs mapped per the table contract. Add anything she names in the three
   questions. Skip titles already present for that date. If the pull fails
   or returns nothing, say so plainly and seed carries plus stated items
   only. Never invent items.
   Carry each pulled row's Type into item_type on the rows she confirms.
   Then, from the same pull, write today's portfolio snapshot: one row per
   project with open counts by type, the nearest due date, and that item's
   title in next_item. Delete any existing rows for today's as_of before
   inserting so the snapshot is replaced rather than duplicated. Projects
   with no open rows are omitted. If the pull failed, skip the snapshot and
   say so; never write a portfolio row from memory.
6. INSERT the daily_logs row: what moved, decisions, flags delta, signals_count, tomorrow's setup.
7. PRE-DRAFT tomorrow's brief per the /brief protocol and INSERT it into `briefs`, so it is waiting when she opens the dashboard.
8. SHOW her a plain summary of every row created or changed.
9. NOTION HANDOFF: print a paste-ready digest for claude.ai, fenced as plain
   markdown, containing only what COS knows that Notion does not. Compare
   against today's pull before writing it; anything already current in
   Notion is omitted. Sections, each skipped when empty and each grouped by item type where it
   applies:
   - Replies sent: Email reply items closed today.
   - Decisions made: Decision items closed today, each with the call and its
     Why, matching the decisions rows written this checkout.
   - Done today: Task and Status check items closed today, one line each,
     with the Notion link when the row came from the tracker.
   - Dropped: items consciously let go, with her stated reason.
   - Carried: items rolled to the next working day, noting their type.
   - New: items added in COS today that have no Notion row yet.
   Facts only, people rule applies, nothing from excluded categories. End
   the digest with one line: "Paste into claude.ai to sync the record."
   COS never writes these to Notion itself.
10. Stop. No sign-off, no offers.

Target: under five minutes of her time.
