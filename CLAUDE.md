# COS · agent note

This repo is no longer agent-operated. The rituals (/checkout, /brief,
/closeout) are retired; the app itself now handles capture, sync, and
prioritization. Read README.md for the architecture.

If you are an agent working in this repo anyway (maintenance, debugging):

1. Work operations only. Never touch, fetch, summarize, or reference Role
   Change & Stipend material or anything about compensation, promotion, or
   personal projects. The Notion allowlist in `api/_lib.js` is law; never
   widen it without an explicit instruction from Aki in the current session.
2. Facts about colleagues only. Never store or generate assessments of people.
3. Plain declarative sentences. No em dashes anywhere, ever. No emoji.
4. Never print keys or tokens. All secrets live in Vercel env vars.
5. State writes go through the app's API layer. Do not write to Supabase or
   Notion directly on your own initiative.
