# GDF'27 Content Studio — setup & deployment

The admin dashboard (`admin.html`) edits the real public website. Saved changes are stored in
Supabase and shown on the public pages after a refresh. If Supabase can't be reached, or a value
was never edited, the site shows its original content from the HTML.

## 1. One-time database setup (Supabase SQL Editor)

Open **Supabase Dashboard → SQL Editor → New query**. Run each file below in order: paste it, then click **Run**.

| Step | File | When |
|---|---|---|
| a | `cms-schema.sql` | Only if the base CMS was never installed. Your live project already has it. |
| b | `cms-admin-upgrade.sql` | Already applied on the live project. Running it again is harmless. |
| c | `seed-gdf.sql` | **Only on a new, empty project.** Never run it twice. The live project already has this content. |
| d | **`cms-migration-v4.sql`** | **Required for the new Content Studio.** Safe to run more than once. |

`cms-migration-v4.sql` only adds things. It never drops or deletes tables or rows. It:

* fixes `column team_members.sort_order does not exist` by adding the column when it's missing. The live database already has it, so nothing changes there.
* adds `site_texts`, `page_sections` and `team_groups`. It also creates one group per existing team section, so the four team tabs keep their current layout.
* adds new optional columns to `team_members`, `team_tabs`, `team_placements`, `applications` and `sponsors`.
* sets up Row Level Security (RLS): visitors can read published content, and only staff can change it.
* creates the `site-media` storage bucket. It accepts JPG, PNG and WebP up to 5 MB. Anyone can view the files; only staff can upload, replace or delete them.

## 2. Create the administrator account

1. Go to **Authentication → Users → Add user**. Create the account with an email and a strong password, and tick "Auto confirm".
2. Copy the new user's **UID**, then run this in the SQL Editor:

```sql
insert into public.admin_users (user_id, role)
values ('PASTE-THE-USER-UID-HERE', 'admin')
on conflict (user_id) do update set role = excluded.role;
```

* `admin`: can edit everything, including **Design settings** and the **countdown date** (both stored in `site_settings`).
* `editor`: can edit all content, but not Design settings or the countdown date.

3. Go to **Authentication → Sign In / Providers** and turn off "Allow new users to sign up".

No password is stored in the code. Anyone who logs in without a row in `admin_users` sees "not an authorised CMS user" and is signed out.

## 3. Deploy

Upload the **whole folder**, including `images/`, `Videos/`, `assets/` and `vendor/`, to the same hosting as before.
The Supabase URL and publishable key are set once in `cms-config.js`. The certificate pages still use `verify-common.js`.
**Never put a `service_role` or secret key in any file.**

## 4. Using the Content Studio

Open `/admin/` and sign in. Use the **EN / AR / TR** buttons to switch the dashboard language. This choice is independent of the public site's language.

| Section | What you can change |
|---|---|
| Header & navigation | Logo upload, website name visibility, menu order, link and visibility for each item, custom links, menu labels (EN/AR/TR), header colours |
| Homepage → Hero | Emblem, optional background image, video on/off, overlay colour and strength, title lines, tagline, button labels and links, countdown title/labels/visibility, countdown date |
| Homepage → President's message / President's message page | Photo, signature, photo position, every paragraph, greeting, name, role, button label/link/visibility |
| Homepage → Venue | Title, school, address, email, phone, Google Maps link, embedded map URL, optional photo, map visibility |
| Homepage → Sections & order | Drag to reorder Hero / President / Venue / Sponsors, show or hide each, background and text colour and spacing for each |
| Sponsors | Add, edit, delete and drag-to-reorder; logo upload, website, category, tier, published state; section title, categories and visibility |
| Applications | Forms (title, description, button label, form URL, image upload, open/close dates, published, order), Application Information (heading, points, protocol link), page title, section order and visibility |
| About page | Every heading and paragraph, partner logos and links, core aims list, optional image per section, colours, section order and visibility |
| Team | Tabs (add, rename, translate, describe, reorder, hide, delete), groups/units (title, description, image, order), members (photo, name, role, biography, social links, published), drag members to reorder them or move them between groups, add a member to several tabs |
| Footer | Logo, description, contact information, phone numbers, social links, labels, copyright, visibility of each column, footer colours |
| Design settings | Global colours, fonts, base font size, corner radius, section spacing, button style; live preview; "Reset to original" |
| Committees / FAQ | Same records as before, now with image upload and drag ordering |
| All website texts | Every translatable text on the site (195 keys), searchable and filterable by page |
| Media library | All uploaded images, in-use/unused filter, copy URL, delete unused files |

**Live preview** opens the real page next to the editor and shows unsaved edits. Nothing is published until you click **Save changes**.
**Unsaved-changes warning**: leaving a page or closing the tab asks for confirmation.
**Translations**: English is required. Leave Arabic or Turkish empty to use the site's existing translation. "Reset to original" restores the original text.

## 5. How the public site uses the CMS

* `cms-boot.js` runs in `<head>`. It applies the last saved design and hidden sections from a browser cache, so the old design doesn't flash on screen.
* `cms-public.js` loads `site_texts`, `page_sections`, `site_settings` and the content tables using the publishable key. It then applies them and refreshes the browser cache.
* `i18n.js` uses a CMS text first, then the built-in translation, then the original HTML.
* Rich text (president's closing line) is cleaned before display. Only `<br>`, `<strong>`, `<em>`, `<a href>` and a few similar tags are kept.

## 6. Troubleshooting

* **Yellow banner "The CMS tables are missing"**: run `cms-migration-v4.sql`.
* **"Only administrators can change this setting"**: your account role is `editor`.
* **Upload fails**: the file must be JPG, PNG or WebP and under 5 MB, and the bucket policies from the migration must exist.
* **Change not visible**: hard-refresh the public page (Ctrl/Cmd+Shift+R).

## 7. GitHub Pages deployment

The site uses static directory routes (`<route>/index.html`), so clean URLs do not depend on
`.htaccess` or server-side rewrites. The original `.html` pages remain available as legacy URLs.
The clean route pages set a document base URL so local assets and links also work on project sites
served below `/<repository>/`.

| Legacy URL | Clean URL |
|---|---|
| `/admin.html` | `/admin/` |
| `/about-us.html` | `/about/` |
| `/applications.html` | `/applications/` |
| `/committees.html` | `/committees/` |
| `/committee-detail.html?id=...` | `/committee/?id=...` |
| `/certificate.html?id=...` | `/certificate/?id=...` |
| `/faq.html` | `/faq/` |
| `/message-from-president.html` | `/president/` |
| `/our-team.html` | `/team/` |
| `/verify.html` | `/verify/` |

1. Push the complete project to a GitHub repository.
2. In **Settings → Pages**, choose the branch and `/ (root)` as the publishing source.
3. Wait for the deployment, then check the Pages URL. For a project site, routes include the
   repository prefix, for example `https://USERNAME.github.io/REPOSITORY/admin/`.
4. Replace the existing `https://YOUR-DOMAIN.com` placeholders in page metadata, `sitemap.xml`,
   and `robots.txt` with the actual public site origin and base path. For a project site, that base
   path includes `/REPOSITORY`; for a user site or custom domain, use the site's root path.

All local asset and navigation URLs are relative to the project root; do not add a leading `/` when
adding further local URLs, as that would bypass the project-site repository prefix.
