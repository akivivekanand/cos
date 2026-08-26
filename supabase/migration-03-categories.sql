-- Categories on checklist items, plus the materialized portfolio.
-- Paste into the Supabase SQL Editor and run once.
alter table checklist_items
  add column if not exists item_type text not null default 'Task'
  check (item_type in ('Task','Email reply','Decision','Status check'));

create table if not exists portfolio (
  id uuid primary key default gen_random_uuid(),
  as_of date not null default current_date,
  project text not null,
  slug text,
  open_tasks int not null default 0,
  open_emails int not null default 0,
  open_decisions int not null default 0,
  open_checks int not null default 0,
  next_due date,
  next_item text not null default '',
  created_at timestamptz not null default now(),
  unique (as_of, project)
);

create index if not exists idx_portfolio_as_of on portfolio (as_of);

alter table portfolio enable row level security;
drop policy if exists "cos_all" on portfolio;
create policy "cos_all" on portfolio
  for all to authenticated using (true) with check (true);
