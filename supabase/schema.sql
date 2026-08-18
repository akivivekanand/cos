-- COS · Work Operations Brain · Supabase schema
-- Paste this whole file into the Supabase SQL Editor and run it once.

-- ============ tables ============

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  status text not null default 'steady' check (status in ('active','steady','waiting','attention')),
  next_action text not null default '',
  milestone text not null default '',
  pct int not null default 0 check (pct between 0 and 100),
  touched date not null default current_date,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists week (
  id uuid primary key default gen_random_uuid(),
  week_of date not null unique,
  set_at text not null default 'pending',
  priorities jsonb not null default '[]',
  days jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  decision_date date not null default current_date,
  source text not null default 'checkout',
  decision text not null,
  why text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists flags (
  id uuid primary key default gen_random_uuid(),
  flag_date date not null default current_date,
  text text not null,
  needs text not null default '',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists today (
  id uuid primary key default gen_random_uuid(),
  log_date date not null unique,
  schedule jsonb not null default '[]',
  hours jsonb,
  created_at timestamptz not null default now()
);

create table if not exists signals (
  id uuid primary key default gen_random_uuid(),
  lane text not null default 'paste' check (lane in ('paste','drop','flow')),
  filename text not null default '',
  content text,
  summary text,
  storage_path text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null unique,
  signals_count int not null default 0,
  body text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists weekly_logs (
  id uuid primary key default gen_random_uuid(),
  week_of date not null unique,
  body text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists briefs (
  id uuid primary key default gen_random_uuid(),
  generated_at timestamptz not null default now(),
  md text not null
);

-- ============ row level security ============
-- Single-operator system: any authenticated user (you) gets full access.
-- The service key used by Claude Code bypasses RLS by design.

alter table projects enable row level security;
alter table week enable row level security;
alter table decisions enable row level security;
alter table flags enable row level security;
alter table today enable row level security;
alter table signals enable row level security;
alter table daily_logs enable row level security;
alter table weekly_logs enable row level security;
alter table briefs enable row level security;

do $$
declare t text;
begin
  foreach t in array array['projects','week','decisions','flags','today','signals','daily_logs','weekly_logs','briefs']
  loop
    execute format('drop policy if exists "cos_all" on %I', t);
    execute format('create policy "cos_all" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ============ storage bucket for dropped files ============

insert into storage.buckets (id, name, public)
values ('inbox', 'inbox', false)
on conflict (id) do nothing;

drop policy if exists "cos_inbox_all" on storage.objects;
create policy "cos_inbox_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'inbox')
  with check (bucket_id = 'inbox');

-- ============ seed: the seven work projects ============
-- Real facts, honest zeros. Correct pct and next_action at your first checkout.

insert into projects (slug, name, status, next_action, milestone, pct, touched, notes) values
('groundwork', 'Groundwork · adoption pilot', 'active',
 'Confirm the Brianna demo date and lock the three pilot metrics',
 'Adoption pilot launched', 0, current_date,
 '32 production releases. 11-template design engine. Database-enforced security. Executive sponsorship. Pilot pending; the demo and three pre-defined metrics are the gating actions. Accuracy rule: no adoption, usage, or hours-saved claims until pilot data exists.'),
('guide-series', 'International Students Guide Series', 'waiting',
 'Confirm CCAD sign-off status (target date was Jul 30)',
 'CCAD sign-off', 0, current_date,
 '11 publications, roughly 58 pages, four audiences: student, alumni, recruiter, employer representative. Includes the H-1B sub-series. Ships only after sign-off; no soft launches, no partial releases.'),
('pathfinder', 'Pathfinder · newsletter', 'steady',
 'Set the fall cycle plan (Issue 7 timing, features, voices)',
 'Fall cycle planned', 0, current_date,
 'Six issues Oct 2025 through Apr 2026. 44% average open rate against a 23-34% sector benchmark. List around 2,650. Nine featured voices from seven countries.'),
('aycp', 'AYCP · Activate Your Career Plan', 'active',
 'Stand up the fully virtual fall cohort plan',
 'Fall cohort launched', 0, current_date,
 'Spring 2026: 28 applications, 20 admitted, 18 engaged, 10 certificates at the 1,000-point bar. Fall 2026 runs fully virtual.'),
('career-labs', 'Career Labs · fall series', 'active',
 'Outline the four-lab series and the flagship workshop',
 'Fall series locked', 0, current_date,
 'The fall plan: a four-lab Career Lab series plus one flagship workshop, planned against advising load.'),
('iec', 'IEC · assessment cycle', 'steady',
 'Confirm follow-up actions from the 2026 assessment cycle',
 'Follow-up actions assigned', 0, current_date,
 '66-respondent survey plus three focus groups with 24 students. 17-page findings report and 26-page comprehensive report. Cycle complete; follow-through is the open thread.'),
('advising', 'Advising', 'steady',
 'Notes at checkout', 'Ongoing', 0, current_date,
 'Ongoing appointments. 35 across FY26. Tracks load and anything an appointment surfaces that needs follow-up.')
on conflict (slug) do nothing;

-- Current week placeholder; the first closeout replaces it with a real plan.
insert into week (week_of, set_at, priorities, days) values
(date_trunc('week', current_date)::date, 'pending',
 '[]',
 '[{"label":"Mon","hours":0,"items":[]},{"label":"Tue","hours":0,"items":[]},{"label":"Wed","hours":0,"items":[]},{"label":"Thu","hours":0,"items":[]},{"label":"Fri","hours":0,"items":[]}]')
on conflict (week_of) do nothing;
