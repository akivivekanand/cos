# COS · Work Operations Brain

Your chief of staff for Suffolk work, on your stack. Code and protocol live in this GitHub repo. All state lives in Supabase. The dashboard deploys to Vercel behind your Supabase login. The rituals (checkout, brief, closeout) run in Claude Code on the web, connected to this repo, writing state through the Supabase API.

Setup runs in four parts. Parts 1 and 2 are today's; 3 and 4 take about fifteen minutes combined whenever you do them.

## Part 1 · GitHub repo (5 minutes)

1. github.com > New repository. Name: `cos`. Visibility: **Private**. No template, no README (this zip has one).
2. On the empty repo page, click "uploading an existing file", drag in everything from this zip (the folders and files, not the zip itself), commit to main.
3. Confirm the file list shows `.claude/`, `CLAUDE.md`, `dashboard/`, `supabase/`, `README.md`, `vercel.json`. If `.claude` didn't upload (some browsers skip dotfolders on drag), use Add file > Create new file, type `.claude/commands/checkout.md` as the name, and paste each command file's contents; three files total.

## Part 2 · Claude Code on the web (5 minutes)

1. Go to claude.com/code, sign in with your Claude account.
2. Connect GitHub when prompted and grant access to the `cos` repo (installing the Claude GitHub App on just that repo is enough).
3. Start a session on `cos`. Say: "Read CLAUDE.md and confirm you understand the content law, the table contracts, and the three rituals." It should play the system back to you accurately. The rituals will report no connection yet; that is correct until Part 4.

## Part 3 · Supabase (10 minutes)

1. supabase.com > New project. Name it `cos`, set a strong database password, pick the closest region.
2. SQL Editor > New query > paste the entire contents of `supabase/schema.sql` > Run. This creates every table, row-level security, the inbox storage bucket, and seeds your seven work projects.
3. Authentication > Users > Add user: your email and a password. This is your dashboard login.
4. Project Settings > API: copy the Project URL, the anon public key, and the service_role key. The service key is the powerful one; it goes only into the Claude Code environment in Part 4, never into the dashboard.

## Part 4 · Vercel + wiring (10 minutes)

1. vercel.com > Add New > Project > import the `cos` repo. Framework preset: Other. Root Directory: leave at the repo root (vercel.json points output at dashboard/). Deploy.
2. In the repo, edit `dashboard/config.js`: paste the Project URL and anon key from Part 3, commit. Vercel redeploys automatically; open the vercel.app URL, sign in with the user from Part 3.4, and the cockpit is live on seeded state.
3. Back in Claude Code on the web: open your environment settings (Environments > your Default environment) and add two variables: `SUPABASE_URL` (the Project URL) and `SUPABASE_SERVICE_KEY` (the service_role key). If your environment restricts network access, add your Supabase domain to its allowed domains.
4. In a session on `cos`, run `/checkout`. First run: correct the seeded projects (they carry real facts but zero percentages and outside-view next actions), answer the three questions, paste tomorrow's calendar. It writes state, pre-drafts tomorrow's brief, and shows you everything it changed. Refresh the dashboard and watch it come alive.

## Daily rhythm

Morning: open the dashboard (bookmark the vercel.app URL; it works on your phone). The brief is waiting, written at last night's checkout. Two minutes.
During the day: paste or drop signals into the Signals tab as they arrive.
Evening: Claude Code session on `cos`, `/checkout`. Five minutes. The only routine moment state gets written.
Friday 4:30: `/closeout`. Fifteen minutes. Sets next week with its reasoning.

If you skip checkouts, the brief and the dashboard say so instead of pretending. Honest degradation is a feature.

## The content law

Work operations only; promotion, compensation, search, and personal projects never enter this system. Facts about people, never assessments. Transcripts get distilled at checkout, then the raw content is nulled and any stored file deleted; Supabase deletion is real deletion. Full text in CLAUDE.md, which every session reads first.

## Troubleshooting

Dashboard shows "One config to go": config.js is still empty; fill and commit.
Sign-in fails: create the user in Supabase > Authentication, or use Create account once (if email confirmation is on in Supabase Auth settings, confirm it or turn confirmation off for this project).
"Supabase error ... has schema.sql been run?": run Part 3.2.
/checkout says it cannot reach Supabase: the two environment variables from Part 4.3 are missing, or the environment's network settings block the domain.
Vercel deployed but the page 404s: check vercel.json is at the repo root and Root Directory was left as the repo root.
