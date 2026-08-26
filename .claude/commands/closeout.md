# /closeout · Friday 4:30, sets the week

Follow CLAUDE.md throughout. Steps:

0. PREFLIGHT: confirm `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are both set. If either is missing, say so plainly and stop. On any failed call, show the error plainly and stop. Never fabricate state.
1. RUN a normal /checkout first if today's daily_logs row does not exist (its three questions included).
2. READ this week's daily_logs, the current week row, decisions, flags, all projects.
3. READ THE WEEK BACK to her, before setting anything:
   - Which priorities from the current `week` row landed, and at what honest percentage.
   - Which projects moved and which did not. Name every project untouched 10 or more working days.
   - Decisions made this week, by date.
   - Flags opened and flags closed. Anything open more than a week gets named as open.
   - Checkouts missed. If a working day has no daily log, say which.
   - Checklist honesty: the week's completion rate across checklist_items,
     and every item carried two or more working days, each named as either
     mis-scoped or avoided, with which.
   No inflation. A week that did not go well reads as a week that did not go well.
4. INSERT the weekly_logs row: five-line synthesis (what shipped, what slipped and why, what it means for next week).
5. ASK her one question: next week's three priorities, or should I propose them from state? If proposing, propose exactly three with a one-line Why each and let her confirm or edit.
6. INSERT the new week row: week_of = next Monday, set_at = now, priorities at pct 0 with notes. For each day, read that date's row in `today` if one exists and set committed hours to its deep + meetings + advising; only where no row exists, ask or estimate and say which.
7. INSERT one decisions row: "This week runs on: <P1, P2, P3>" with the Why.
8. SHOW her the summary of rows written.
9. Stop.

Target: fifteen minutes.
