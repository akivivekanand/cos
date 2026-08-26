-- Daily checklist: one day's execution state. Notion holds the record.
-- Paste into the Supabase SQL Editor and run once.
create table if not exists checklist_items (
  id uuid primary key default gen_random_uuid(),
  item_date date not null default current_date,
  position int not null default 0,
  title text not null,
  note text not null default '',
  source_url text not null default '',
  project_slug text,
  status text not null default 'open'
    check (status in ('open','done','carried','dropped')),
  carried_from date,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  unique (item_date, title)
);

alter table checklist_items enable row level security;
drop policy if exists "cos_all" on checklist_items;
create policy "cos_all" on checklist_items
  for all to authenticated using (true) with check (true);
