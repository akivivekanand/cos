-- COS migration 04 · The Notion era
-- Paste this whole file into the Supabase SQL Editor and run it once.
--
-- Notion becomes the single source of truth for projects and tasks.
-- Supabase keeps only COS-native state: the capture inbox, daily capacity,
-- AI focus lists, decisions, and flags. Decisions and flags already exist
-- from the original schema and are reused unchanged.
--
-- This migration is NON-DESTRUCTIVE. Legacy tables (projects, week, today,
-- signals, daily_logs, weekly_logs, briefs, checklist_items, portfolio) are
-- left in place. A commented decommission block is at the bottom; run it
-- yourself only after the new system has proven itself for a couple of weeks.

-- ============ inbox: the quick-capture staging area ============
-- The one place ad hoc writes are welcome. Items live here until reviewed
-- and pushed to Notion, or marked handled.

create table if not exists inbox_items (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  project text,                        -- allowlisted project name or null
  status text not null default 'open'
    check (status in ('open','synced','handled')),
  notion_page_id text,                 -- set when pushed
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============ capacity: the two-tap daily check-in ============

create table if not exists capacity_days (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  hours numeric not null default 6,
  energy text not null default 'medium'
    check (energy in ('low','medium','high')),
  created_at timestamptz not null default now()
);

-- ============ focus lists: prioritizer output, one per day ============

create table if not exists focus_lists (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  capacity jsonb not null default '{}',
  result jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============ row level security ============
-- The browser no longer talks to PostgREST at all; every read and write goes
-- through Vercel serverless functions holding the service key, which bypasses
-- RLS. RLS is still enabled so nothing is exposed if a key ever leaks into
-- a client context.

alter table inbox_items enable row level security;
alter table capacity_days enable row level security;
alter table focus_lists enable row level security;

do $$
declare t text;
begin
  foreach t in array array['inbox_items','capacity_days','focus_lists']
  loop
    execute format('drop policy if exists "cos_all" on %I', t);
    execute format('create policy "cos_all" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ============ decommission block (do not run yet) ============
-- After the Notion-era system has run cleanly for a couple of weeks, and any
-- history worth keeping has been exported, these legacy tables can go.
-- Deleting them is real deletion. Run deliberately, table by table.
--
-- drop table if exists checklist_items;
-- drop table if exists portfolio;
-- drop table if exists briefs;
-- drop table if exists daily_logs;
-- drop table if exists weekly_logs;
-- drop table if exists signals;
-- drop table if exists today;
-- drop table if exists week;
-- drop table if exists projects;
