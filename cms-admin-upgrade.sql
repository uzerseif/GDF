-- GDF’27 CMS upgrade: run once in Supabase SQL Editor
-- Fixes the team page error and makes the admin ordering field available.
alter table public.team_members
  add column if not exists sort_order integer not null default 0;

-- Ensure the public media bucket exists (the full cms-schema.sql also creates it).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 5242880, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set public = true;
