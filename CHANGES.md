# GDF'27 — Content Studio upgrade: changed files & database changes

## New files
| File | Purpose |
|---|---|
| `cms-migration-v4.sql` | Database migration for the new CMS. Safe to run more than once and adds without deleting (see below). |
| `cms-config.js` | Supabase URL + **publishable** key, shared by the public site and the admin. |
| `cms-boot.js` | Runs in `<head>`. Applies design tokens and hidden sections from the browser cache before the first paint. |
| `cms-defaults.js` | The original English texts of the site (generated from the HTML). The admin uses them to pre-fill forms, as fallbacks, and for "Reset to original". |
| `admin-i18n.js` | Dashboard interface strings in English, Arabic and Turkish. |
| `admin-pages.js` | Dashboard pages: Header, Homepage, President, Applications, About, Team, Footer, Sponsors, Committees, FAQ, All texts, Design, Media. |
| `CMS-SETUP.md` | Setup, deployment and usage guide. |
| `CHANGES.md` | This file. |
| `TESTING.md` | Test results. |

## Rewritten files
| File | Change |
|---|---|
| `admin.html`, `admin.css`, `admin.js` | New premium dark dashboard: sidebar, EN/AR/TR with RTL, toasts, dialogs, unsaved-changes guard, uploader with drag & drop and progress, drag-and-drop ordering, live preview. **News & Updates removed.** |
| `cms-public.js` | Applies every CMS area to the public pages: texts, header, footer, hero, president, venue, sponsors, applications, About, team (tabs built from the DB), section order and visibility, theme. Includes caching and preview mode, and keeps the original content as fallback. |

## Modified files
| File | Change |
|---|---|
| `i18n.js` | Uses CMS text overrides (`window.GDF_CMS_TEXTS`) before the built-in translations, cleans rich text, and adds `GDF_i18n_refresh()`. |
| `script.js` | The countdown target comes from `site_settings.event.start`. The default is still 20 March 2027, 09:00 (UTC+3). |
| `our-team.js` | Picks up tabs and panels again after the CMS rebuilds them (`gdf:team-rendered`). |
| `style.css` | A small appended block of styles for the optional CMS elements: venue photo, signature, section images, unit images, photo-right layout. Existing rules were not changed. |
| All 11 public HTML pages | Load `cms-config.js` + `cms-boot.js`, and also the Supabase SDK + `cms-public.js` on pages that lacked them. They gain `data-cms` / `data-cms-section` hooks and `data-i18n` keys for the brand name and the hero year. No visible content was removed. |
| `index.html` | Closed the `venue` section before `sponsors`. The sponsors section was accidentally nested inside the venue section, which made separate ordering and hiding impossible. |
| `CMS-SETUP.txt` | Now points to `CMS-SETUP.md`. |
| `README.txt` | One line added at the top pointing to the new docs. |

Unchanged: every image, video, vendor file, certificate and verification file, `translations.js`, page CSS files, and the older SQL files (`cms-schema.sql`, `cms-admin-upgrade.sql`, `seed-gdf.sql`, `supabase-migration.sql`).

## Database changes (`cms-migration-v4.sql`)
Nothing is dropped or deleted, and existing rows are kept.

**Fix for `column team_members.sort_order does not exist`:** the original table was created before this column existed, and `create table if not exists` never adds columns to an existing table. The migration runs `alter table … add column if not exists sort_order integer not null default 0` and adds an index. Your live database already has the column, so this step does nothing there.

| Object | Change |
|---|---|
| `team_members` | + `social jsonb` (Instagram/LinkedIn/X/website/email). Also makes sure `sort_order`, `is_published`, `bio`, `photo_url` and `updated_at` exist. |
| `team_tabs` | + `description jsonb` (EN/AR/TR). Also makes sure `sort_order`, `is_published` and `updated_at` exist. |
| `team_groups` (new) | Groups and units inside a tab: `tab_id → team_tabs`, `title`, `description`, `image_url`, `sort_order`, `is_published`. Filled automatically from the existing `team_placements.group_no/group_title`. |
| `team_placements` | + `group_id → team_groups (on delete set null)`. Existing placements are linked to their back-filled group. |
| `applications` | + `image_url`, + `button_label jsonb`, + `updated_at` |
| `sponsors` | + `tier`, + `updated_at`. The fixed `category in (sponsor, partner, media)` check is replaced by a slug-format check, so categories can be managed from the admin. Existing values still pass. |
| `site_texts` (new) | `key` (the existing `data-i18n` key) → `value {en,ar,tr}`, `is_html`. Overrides any text on the site. |
| `page_sections` (new) | `(page, section_key)` unique, plus `sort_order`, `is_visible`, `settings jsonb` (images, links, colours, layout, lists). |
| `site_settings` | Seeds `event.start` (countdown) and `theme.tokens` (design) only if they are missing (`on conflict do nothing`). |
| Triggers | `updated_at` triggers on the new and changed tables. |
| RLS | `team_groups`: public reads published rows, staff manage. `site_texts` and `page_sections`: public read, staff manage. `site_settings`: public read, **admin**-only write. `admin_users`: each user reads their own row, admins manage. |
| Storage | `site-media` bucket: public, 5 MB, JPG/PNG/WebP only. Only staff can list, upload, update or delete. |
| Helpers | `is_i18n_loose()` added. `is_i18n`, `is_staff`, `is_admin` and `set_updated_at` are re-created idempotently. |
