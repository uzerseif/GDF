-- =====================================================================
-- GDF'27 CMS — MIGRATION V4 (full website CMS)
-- Safe to run on the EXISTING Supabase project, and safe to run again.
--   * Only CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE.
--   * No DROP TABLE, no DELETE, no TRUNCATE. Existing rows are preserved.
--   * Requires the base CMS schema (cms-schema.sql). If some of its objects are
--     missing, section 1 re-creates the helpers it needs.
-- Run in: Supabase Dashboard > SQL Editor > New query > paste > Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. HELPERS (re-created idempotently)
-- ---------------------------------------------------------------------
create or replace function public.is_i18n(v jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select v is not null and jsonb_typeof(v) = 'object'
     and length(trim(coalesce(v ->> 'en', ''))) > 0;
$$;

-- Like is_i18n but "en" may be empty (used for optional translated texts).
create or replace function public.is_i18n_loose(v jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select v is null or jsonb_typeof(v) = 'object';
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;

create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'editor' check (role in ('admin', 'editor')),
  created_at timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()));
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users
                 where user_id = (select auth.uid()) and role = 'admin');
$$;

revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_staff() to authenticated;
grant  execute on function public.is_admin() to authenticated;

alter table public.admin_users enable row level security;
drop policy if exists "own row"       on public.admin_users;
drop policy if exists "admins manage" on public.admin_users;
create policy "own row" on public.admin_users
  for select to authenticated using (user_id = (select auth.uid()));
create policy "admins manage" on public.admin_users
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- 2. FIX: team_members.sort_order  ("column team_members.sort_order does not exist")
--    The original team_members table was created before this column existed,
--    and "create table if not exists" never adds columns to an existing table.
-- ---------------------------------------------------------------------
alter table public.team_members add column if not exists sort_order   integer not null default 0;
alter table public.team_members add column if not exists is_published boolean not null default true;
alter table public.team_members add column if not exists bio          jsonb;
alter table public.team_members add column if not exists photo_url    text;
alter table public.team_members add column if not exists social       jsonb not null default '{}'::jsonb;
alter table public.team_members add column if not exists updated_at   timestamptz not null default now();
create index if not exists team_members_sort_idx on public.team_members (sort_order);

-- ---------------------------------------------------------------------
-- 3. TEAM TABS / GROUPS (units) / PLACEMENTS
-- ---------------------------------------------------------------------
alter table public.team_tabs add column if not exists description  jsonb;
alter table public.team_tabs add column if not exists sort_order   integer not null default 0;
alter table public.team_tabs add column if not exists is_published boolean not null default true;
alter table public.team_tabs add column if not exists updated_at   timestamptz not null default now();

-- A group is one block of cards inside a tab (.tm-grp). In the "Units" tab every
-- group is a unit (title, description, image). In other tabs the title is optional.
create table if not exists public.team_groups (
  id           uuid primary key default gen_random_uuid(),
  tab_id       uuid not null references public.team_tabs (id) on delete cascade,
  title        jsonb check (public.is_i18n_loose(title)),
  description  jsonb check (public.is_i18n_loose(description)),
  image_url    text,
  sort_order   integer not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists team_groups_tab_idx on public.team_groups (tab_id, sort_order);

alter table public.team_placements add column if not exists group_id   uuid references public.team_groups (id) on delete set null;
alter table public.team_placements add column if not exists sort_order integer not null default 0;
create index if not exists team_placements_group_idx on public.team_placements (group_id, sort_order);

-- Back-fill: one team_groups row per existing (tab, group_no); keeps the old
-- group_title as the group/unit title. Only runs for placements without a group.
do $$
declare r record; gid uuid;
begin
  for r in
    select p.tab_id, p.group_no,
           (array_agg(p.group_title) filter (where p.group_title is not null))[1] as title
      from public.team_placements p
     where p.group_id is null
     group by p.tab_id, p.group_no
     order by p.tab_id, p.group_no
  loop
    insert into public.team_groups (tab_id, title, sort_order)
    values (r.tab_id, r.title, r.group_no)
    returning id into gid;
    update public.team_placements
       set group_id = gid
     where tab_id = r.tab_id and group_no = r.group_no and group_id is null;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. APPLICATIONS / SPONSORS / COMMITTEES / FAQ — new optional columns
-- ---------------------------------------------------------------------
alter table public.applications add column if not exists image_url    text;
alter table public.applications add column if not exists button_label jsonb;
alter table public.applications add column if not exists updated_at   timestamptz not null default now();

alter table public.sponsors add column if not exists tier       text;
alter table public.sponsors add column if not exists updated_at timestamptz not null default now();
-- Categories become admin-defined (labels live in page_sections home/sponsors).
alter table public.sponsors drop constraint if exists sponsors_category_check;
alter table public.sponsors drop constraint if exists sponsors_category_format;
alter table public.sponsors add constraint sponsors_category_format
  check (category ~ '^[a-z0-9-]{1,40}$');

-- ---------------------------------------------------------------------
-- 5. SITE TEXTS — every translatable text on the public website.
--    key = the data-i18n key already used by the HTML (e.g. "hero.tagline").
--    value = {"en": "...", "ar": "...", "tr": "..."}; a missing language
--    falls back to the original text shipped with the website.
-- ---------------------------------------------------------------------
create table if not exists public.site_texts (
  key        text primary key check (key ~ '^[A-Za-z0-9_.-]{1,120}$'),
  value      jsonb not null default '{}'::jsonb check (jsonb_typeof(value) = 'object'),
  is_html    boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. PAGE SECTIONS — visibility, order, images, links, colours, layout and
--    repeatable lists (navigation, footer links, about partners, ...).
-- ---------------------------------------------------------------------
create table if not exists public.page_sections (
  id          uuid primary key default gen_random_uuid(),
  page        text not null check (page ~ '^[a-z0-9-]{1,40}$'),
  section_key text not null check (section_key ~ '^[a-z0-9-]{1,40}$'),
  sort_order  integer not null default 0,
  is_visible  boolean not null default true,
  settings    jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (page, section_key)
);
create index if not exists page_sections_page_idx on public.page_sections (page, sort_order);

-- ---------------------------------------------------------------------
-- 7. TRIGGERS + ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['team_groups', 'site_texts', 'page_sections',
                           'team_members', 'team_tabs', 'applications', 'sponsors'] loop
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$s', t);
    execute format('create trigger trg_%1$s_updated before update on public.%1$s
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

alter table public.team_groups   enable row level security;
alter table public.site_texts    enable row level security;
alter table public.page_sections enable row level security;

drop policy if exists "public read published" on public.team_groups;
drop policy if exists "staff manage"          on public.team_groups;
create policy "public read published" on public.team_groups
  for select to anon, authenticated using (is_published);
create policy "staff manage" on public.team_groups
  for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

drop policy if exists "public read texts" on public.site_texts;
drop policy if exists "staff manage"      on public.site_texts;
create policy "public read texts" on public.site_texts
  for select to anon, authenticated using (true);
create policy "staff manage" on public.site_texts
  for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- Hidden sections are still readable: the site must know a section is hidden.
drop policy if exists "public read sections" on public.page_sections;
drop policy if exists "staff manage"         on public.page_sections;
create policy "public read sections" on public.page_sections
  for select to anon, authenticated using (true);
create policy "staff manage" on public.page_sections
  for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

grant select on public.team_groups, public.site_texts, public.page_sections to anon, authenticated;
grant insert, update, delete on public.team_groups, public.site_texts, public.page_sections to authenticated;

-- site_settings (theme / event date): public read, admin write (from cms-schema.sql).
create table if not exists public.site_settings (
  key        text primary key check (key ~ '^[a-z0-9_.]+$'),
  value      jsonb not null,
  label      text,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "public read settings"  on public.site_settings;
drop policy if exists "admins write settings" on public.site_settings;
create policy "public read settings" on public.site_settings
  for select to anon, authenticated using (true);
create policy "admins write settings" on public.site_settings
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

insert into public.site_settings (key, value, label) values
  ('event.start',  '"2027-03-20T09:00:00+03:00"'::jsonb, 'Event start (countdown target)'),
  ('theme.tokens', '{}'::jsonb,                          'Design tokens (Design Settings page)')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 8. STORAGE — public "site-media" bucket. JPG/PNG/WebP only (SVG can carry
--    scripts), 5 MB max. Anyone can view by URL, only staff can write.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "staff list media"   on storage.objects;
drop policy if exists "staff upload media" on storage.objects;
drop policy if exists "staff update media" on storage.objects;
drop policy if exists "staff delete media" on storage.objects;
create policy "staff list media" on storage.objects
  for select to authenticated using (bucket_id = 'site-media' and (select public.is_staff()));
create policy "staff upload media" on storage.objects
  for insert to authenticated with check (bucket_id = 'site-media' and (select public.is_staff()));
create policy "staff update media" on storage.objects
  for update to authenticated
  using (bucket_id = 'site-media' and (select public.is_staff()))
  with check (bucket_id = 'site-media' and (select public.is_staff()));
create policy "staff delete media" on storage.objects
  for delete to authenticated using (bucket_id = 'site-media' and (select public.is_staff()));

-- Ask PostgREST to pick up the new tables/columns immediately.
notify pgrst, 'reload schema';
-- =====================================================================
-- DONE. Next: create your admin user (see CMS-SETUP.md, step 3).
-- =====================================================================
