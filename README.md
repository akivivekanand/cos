# COS · Chief of Staff · Work Operations

Aki's personal work-operations system for Suffolk CEDS. As of the Notion-era
rebuild, COS is a self-contained web app. No agent, no rituals, no Claude Code
required to operate it.

## The architecture in one paragraph

Notion is the single source of truth for projects and tasks (the shared Tasks
database in the CEDS teamspace). COS is the lens on top of it: a Vercel-hosted
dashboard that reads Notion live, visualizes the work, takes a two-tap daily
capacity check-in, and uses the Anthropic API to rank what deserves focus
today. Quick captures land in a Supabase staging inbox and reach Notion only
after a review-and-push step, so nothing messy ever lands in the shared
teamspace unreviewed. Checking off a task in COS writes through to Notion
immediately. Supabase keeps only COS-native state: the inbox, capacity days,
focus lists, decisions, and flags.

## Repo layout

```
dashboard/index.html   the whole front end, one file, vanilla HTML/CSS/JS
dashboard/config.js    Supabase URL + anon key (client-safe, auth only)
api/_lib.js            shared: auth check, Supabase REST, Notion client
api/state.js           GET  · the single combined read
api/act.js             POST · every write action
api/prioritize.js      POST · focus engine and weekly readback (Anthropic API)
supabase/              schema.sql (legacy) + migrations; run 04 for this era
vercel.json            static output from dashboard/, functions from api/
```

## One-time setup

1. **Supabase migration.** Paste `supabase/migration-04-notion-era.sql` into
   the Supabase SQL Editor and run it. It only adds tables
   (`inbox_items`, `capacity_days`, `focus_lists`). Legacy tables stay put; a
   commented decommission block at the bottom is for later, by hand.

2. **Notion integration.** In Notion, create (or reuse) an internal
   integration with read and **insert/update** content capabilities, then
   share the **Tasks database only** with it. The old integration was
   read-only by design; this era writes tasks, so the capability upgrade is
   required. Nothing outside the Tasks database should be shared with it.

3. **Vercel environment variables** (Project Settings > Environment
   Variables, Production):
   - `SUPABASE_URL` · the project URL
   - `SUPABASE_SERVICE_KEY` · service role key (server-side only, never in the client)
   - `NOTION_TOKEN` · the integration token from step 2
   - `ANTHROPIC_API_KEY` · from console.anthropic.com
   - `NOTION_TASKS_DATA_SOURCE_ID` · optional; defaults to the known Tasks collection id

4. **Deploy.** Commit and push; Vercel builds the static dashboard and the
   three functions automatically. Sign in with the same Supabase Auth account
   as before.

## How the app enforces the content rules

The rules that used to live in CLAUDE.md now live in code, where they are
actually enforced:

- **Allowlist at the query** (`api/_lib.js`, `PROJECT_ALLOWLIST`). Only these
  Project values are ever fetched from Notion: Groundwork, FDS, Career Plan,
  Handshake Data & API, Career Labs, Guides, Grad Fellow, INTO Partnership,
  Coordination. Role Change & Stipend and anything unlisted never enters
  state, the prioritizer, or the screen. Pushing an inbox item to Notion is
  refused unless it is tagged to an allowlisted project.
- **Prompt law** (`api/prioritize.js`, `CONTENT_LAW`). The focus engine and
  readback run under a system prompt that forbids assessments of colleagues,
  compensation and role-change material, and filler. People appear only as
  factual logistics.
- **Review before the shared space.** Quick captures are staged in Supabase.
  Nothing reaches the Notion teamspace Dave can see until you press Push on a
  reviewed, project-tagged item. Direct toggles on already-synced tasks write
  through, because those are unambiguous.
- **Keys server-side.** The browser holds only your Supabase session. Notion,
  Anthropic, and the service key live in Vercel env vars; every function call
  verifies your session token before doing anything.

## Daily use

Open the app. That is the brief: it has already pulled Notion. Answer the
capacity check-in (hours + energy) and press Set focus; the ranked list with
reasoning appears on Pulse. Capture anything all day in the quick-add bar.
The masthead badge counts unsynced items; push them whenever, and anything
older than 48 hours gets raised at the top of Pulse. Friday, or whenever, hit
Generate readback on the Week tab for an honest synthesis. There is nothing
you have to remember to run.

## Notion schema tolerance

The functions read the Tasks database schema live and locate the title,
status, Project select, Type select, and due-date properties by type and
name pattern, including the status option in the Complete group. Renaming a
property in Notion generally will not break COS, but if reads come back empty
after a schema change, check the extraction logic in `api/_lib.js`
(`tasksSchema`).

## Legacy

The `.claude/commands` rituals (`/checkout`, `/brief`, `/closeout`) and the
old Supabase tables are retired but preserved. Once the new system has run
cleanly for a couple of weeks, delete `.claude/` and run the decommission
block in migration 04 if you want the repo fully clean. History in
`decisions` and `flags` carries forward unchanged.
