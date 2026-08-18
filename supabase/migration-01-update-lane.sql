-- Update lane: project-tagged signals.
-- Paste into the Supabase SQL Editor and run once.
alter table signals add column if not exists project_slug text;
