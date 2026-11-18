-- =====================================================================
-- EVENT CMS — Supabase schema (Phase 2, step 1)
-- Designed from the real structure of GDF V3:
--   committees (6), team (4 tabs, grouped rows, bios), sponsors grid,
--   FAQ (details/summary + optional link), applications (4 Google Forms),
--   countdown date, theme colors, contact/social links.
--
-- Rules of this schema
--   * One Supabase project per client (white-label = separate project).
--   * Every translatable text is jsonb: {"en": "...", "ar": "...", "tr": "..."}
--     "en" is required, other languages are optional (fallback = en).
--     Adding a 4th language later needs NO schema change.
--   * Visitors (anon) can only READ rows where is_published = true.
--   * Only logged-in users listed in admin_users can write.
--   * No service_role key anywhere in frontend code.
--
-- Run once in: Supabase Dashboard > SQL Editor.
-- It does NOT touch your existing `certificates` table.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. HELPERS
-- ---------------------------------------------------------------------

-- A translatable value must be a JSON object that contains a non-empty "en".
create or replace function public.is_i18n(v jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select v is not null
     and jsonb_typeof(v) = 'object'
     and length(trim(coalesce(v ->> 'en', ''))) > 0;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 2. ADMIN USERS  (who may edit)
--    Create the user first in Authentication > Users, then add the row
--    (see the bootstrap section at the bottom).
-- ---------------------------------------------------------------------

create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'editor' check (role in ('admin', 'editor')),
  created_at timestamptz not null default now()
);

-- security definer + empty search_path: no RLS recursion, no hijacking.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_staff() to authenticated;
grant  execute on function public.is_admin() to authenticated;

alter table public.admin_users enable row level security;

-- A user may read only their own row (so the admin page can ask "who am I?").
-- Only admins may add/change/remove staff.
drop policy if exists "own row"      on public.admin_users;
drop policy if exists "admins manage" on public.admin_users;
create policy "own row" on public.admin_users
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "admins manage" on public.admin_users
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));


-- ---------------------------------------------------------------------
-- 3. SITE SETTINGS  (key/value; dates, names, colors, contact, social)
--    Admin-only writes (editors cannot change branding or dates).
-- ---------------------------------------------------------------------

create table if not exists public.site_settings (
  key        text primary key check (key ~ '^[a-z0-9_.]+$'),
  value      jsonb not null,
  label      text,                       -- human label shown in the admin form
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "public read settings" on public.site_settings;
drop policy if exists "admins write settings" on public.site_settings;
create policy "public read settings" on public.site_settings
  for select to anon, authenticated using (true);
create policy "admins write settings" on public.site_settings
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));


-- ---------------------------------------------------------------------
-- 4. CONTENT TABLES
-- ---------------------------------------------------------------------

-- 4.1 Committees (/committees/ cards + /committee/?id=slug)
create table if not exists public.committees (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]+$'),   -- e.g. unga, security-council
  name         jsonb not null check (public.is_i18n(name)),
  short_desc   jsonb not null check (public.is_i18n(short_desc)),    -- card + top of detail page
  about        jsonb check (about  is null or public.is_i18n(about)),   -- "About the Committee"
  expect       jsonb check (expect is null or public.is_i18n(expect)),  -- "What to Expect"
  image_url    text,
  image_alt    jsonb check (image_alt is null or public.is_i18n(image_alt)),
  sort_order   int  not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 4.2 Team tabs  (Presidency / Board of Directors / Advisory Board / Units)
create table if not exists public.team_tabs (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]+$'),   -- used as #hash in the URL
  title        jsonb not null check (public.is_i18n(title)),
  sort_order   int  not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 4.3 Team members: ONE row per person (edit photo/role/bio once).
--     A person may appear in several tabs (e.g. the Secretary-General is in
--     Presidency, Board and Advisory) -> see team_placements.
create table if not exists public.team_members (
  id           uuid primary key default gen_random_uuid(),
  name         jsonb not null check (public.is_i18n(name)),   -- real names: only "en"; "To be announced" is translated
  role         jsonb not null check (public.is_i18n(role)),
  bio          jsonb check (bio is null or public.is_i18n(bio)),  -- null = "Biography coming soon"
  photo_url    text,
  sort_order   int not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 4.3b Placements: where a person appears (tab + group + row + order).
--      group_title is optional (e.g. a unit name above its members).
create table if not exists public.team_placements (
  id          uuid primary key default gen_random_uuid(),
  tab_id      uuid not null references public.team_tabs (id) on delete cascade,
  member_id   uuid not null references public.team_members (id) on delete cascade,
  group_no    int  not null default 0,                         -- .tm-grp
  group_title jsonb check (group_title is null or public.is_i18n(group_title)),
  row_no      int  not null default 0,                         -- .tm-row inside the group
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (tab_id, member_id)
);
create index if not exists team_placements_tab_idx    on public.team_placements (tab_id, group_no, row_no, sort_order);
create index if not exists team_placements_member_idx on public.team_placements (member_id);

-- 4.4 Sponsors & partners  (logo grid / marquee)
create table if not exists public.sponsors (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  logo_url     text not null,
  website_url  text,
  category     text not null default 'sponsor' check (category in ('sponsor', 'partner', 'media')),
  sort_order   int  not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 4.5 FAQ  (<details class="faq-item">, optional action link)
create table if not exists public.faqs (
  id           uuid primary key default gen_random_uuid(),
  question     jsonb not null check (public.is_i18n(question)),
  answer       jsonb not null check (public.is_i18n(answer)),
  link_url     text,
  link_label   jsonb check (link_label is null or public.is_i18n(link_label)),
  sort_order   int  not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 4.6 Applications  (Delegation / Delegate / Press / Chair ... -> Google Forms)
create table if not exists public.applications (
  id           uuid primary key default gen_random_uuid(),
  title        jsonb not null check (public.is_i18n(title)),
  description  jsonb check (description is null or public.is_i18n(description)),
  form_url     text not null check (form_url ~ '^https://'),
  opens_at     timestamptz,
  closes_at    timestamptz,                -- the page can grey out the button after this
  sort_order   int  not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 4.7 News  (NEW feature: your site has no news page yet)
create table if not exists public.news (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title        jsonb not null check (public.is_i18n(title)),
  summary      jsonb check (summary is null or public.is_i18n(summary)),
  body         jsonb check (body is null or public.is_i18n(body)),
  cover_url    text,
  published_at timestamptz not null default now(),
  is_published boolean not null default false,   -- news starts as a draft
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists news_published_idx on public.news (is_published, published_at desc);


-- ---------------------------------------------------------------------
-- 5. TRIGGERS + RLS for all content tables
-- ---------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'committees', 'team_tabs', 'team_members', 'sponsors', 'faqs', 'applications', 'news'
  ] loop
    -- updated_at
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$s', t);
    execute format(
      'create trigger trg_%1$s_updated before update on public.%1$s
         for each row execute function public.set_updated_at()', t);

    -- RLS
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "public read published" on public.%I', t);
    execute format('drop policy if exists "staff manage" on public.%I', t);

    -- visitors: published rows only
    execute format(
      'create policy "public read published" on public.%I
         for select to anon, authenticated using (is_published)', t);

    -- staff: everything (including drafts)
    execute format(
      'create policy "staff manage" on public.%I
         for all to authenticated
         using ((select public.is_staff()))
         with check ((select public.is_staff()))', t);
  end loop;
end
$$;

-- team_placements: no secrets; readable when its person is published.
alter table public.team_placements enable row level security;
drop policy if exists "public read placements" on public.team_placements;
drop policy if exists "staff manage"           on public.team_placements;
create policy "public read placements" on public.team_placements
  for select to anon, authenticated
  using (exists (select 1 from public.team_members m where m.id = member_id and m.is_published));
create policy "staff manage" on public.team_placements
  for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- updated_at for settings too
drop trigger if exists trg_site_settings_updated on public.site_settings;
create trigger trg_site_settings_updated before update on public.site_settings
  for each row execute function public.set_updated_at();



-- ---------------------------------------------------------------------
-- 6. STORAGE  (logos, team photos, committee images, news covers)
--    Public bucket: files are readable by URL; only staff can upload/delete.
--    SVG is intentionally NOT allowed (it can carry scripts).
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media', 'site-media', true,
  2097152,                                           -- 2 MB per file
  array['image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "staff upload media" on storage.objects;
drop policy if exists "staff update media" on storage.objects;
drop policy if exists "staff delete media" on storage.objects;
drop policy if exists "staff list media"   on storage.objects;

create policy "staff list media" on storage.objects
  for select to authenticated
  using (bucket_id = 'site-media' and (select public.is_staff()));
create policy "staff upload media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'site-media' and (select public.is_staff()));
create policy "staff update media" on storage.objects
  for update to authenticated
  using (bucket_id = 'site-media' and (select public.is_staff()))
  with check (bucket_id = 'site-media' and (select public.is_staff()));
create policy "staff delete media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'site-media' and (select public.is_staff()));


-- ---------------------------------------------------------------------
-- 7. SEED — site settings for GDF'27 (values taken from your current files)
--    The single source of truth for the date: event.start feeds BOTH the
--    countdown and any "March 2027" text, so they can never disagree again.
--    (Today: script.js says 2027-03-20 09:00 +03:00; the meta tags say only
--    "March 2027".)
-- ---------------------------------------------------------------------

insert into public.site_settings (key, value, label) values
  ('site.short_name',   '"GDF''27"'::jsonb,                          'Short name'),
  ('site.full_name',    '{"en":"Gaziantep Diplomacy Forum 2027"}'::jsonb, 'Full name'),
  ('site.domain',       '"https://YOUR-DOMAIN.com"'::jsonb,          'Public domain (used in canonical/OG/sitemap)'),
  ('event.start',       '"2027-03-20T09:00:00+03:00"'::jsonb,        'Event start (countdown target)'),
  ('event.location',    '{"en":"Gaziantep, Türkiye"}'::jsonb,        'Location'),
  ('contact.email',     '"gdf27.official@gmail.com"'::jsonb,         'Contact email'),
  ('social.instagram',  '"https://www.instagram.com/gdf.2027"'::jsonb, 'Instagram URL'),
  ('theme.primary',     '"#081933"'::jsonb,                          'Primary color (--maroon)'),
  ('theme.accent',      '"#EAD7B0"'::jsonb,                          'Accent color (--gold)'),
  ('theme.surface',     '"#F1E8D1"'::jsonb,                          'Surface color (--cream)'),
  ('media.logo',        'null'::jsonb,                               'Logo URL (site-media bucket)'),
  ('media.og_image',    'null'::jsonb,                               'Social share image URL')
on conflict (key) do nothing;


-- ---------------------------------------------------------------------
-- 8. BOOTSTRAP THE FIRST ADMIN  (run AFTER creating the user in
--    Authentication > Users; replace the email)
-- ---------------------------------------------------------------------
--
-- insert into public.admin_users (user_id, role)
-- select id, 'admin' from auth.users where email = 'YOU@example.com';
--
-- Then in Authentication settings: DISABLE public sign-ups, so nobody else
-- can create an account. Even if they did, they are not in admin_users and
-- RLS blocks every write.
-- =====================================================================
