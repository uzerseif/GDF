# GDF'27 Content Studio — test results

I ran the tests against a **local Supabase stack** (Supabase CLI 3.1.0 in Docker), set up exactly like your project:
`cms-schema.sql` → `cms-admin-upgrade.sql` → `seed-gdf.sql` → `cms-migration-v4.sql` (run twice to prove it's safe to repeat).
I used Playwright with headless Chromium to drive the real `admin.html` and then checked the real public pages as a visitor.
The accounts were local test accounts (admin, editor, and a signed-in non-staff user). Your live Supabase project was **only read**, never changed.

**Result: 84/84 automated checks passed.**

| # | Check | Result |
|---|---|---|
| 1a | login rejects wrong password | PASS |
| 1b | non-staff account is denied the dashboard | PASS |
| 1c | admin login opens dashboard | PASS |
| 1d | News & Updates removed from admin | PASS |
| 1e | logout returns to login and clears session | PASS |
| 2a | anonymous write to site_texts blocked | PASS |
| 2b | anonymous update of team_members changes nothing | PASS |
| 2c | signed-in non-staff write to page_sections blocked | PASS |
| 2d | editor cannot change admin-only design settings | PASS |
| 2e | editor CAN edit content texts | PASS |
| 2f | anonymous image upload blocked | PASS |
| 2g | non-staff image upload blocked | PASS |
| 3a | hero saves without errors | PASS |
| 3b | hero tagline (EN) on public site | PASS |
| 3c | hero countdown label on public site | PASS |
| 3d | hero button link updated | PASS |
| 3e | countdown target from CMS (event.start) | PASS |
| 3f | hero tagline (AR) + RTL | PASS |
| 3g | hero tagline (TR) | PASS |
| P1 | live preview shows unsaved edits | PASS |
| P2 | unsaved preview edits not published | PASS |
| 4a | upload rejects non-image files | PASS |
| 4b | header saves | PASS |
| 4c | header logo replaced from Supabase Storage | PASS |
| 4d | nav label edited | PASS |
| 4e | nav item hidden | PASS |
| 6a | president message saves | PASS |
| 6b | letter text on homepage | PASS |
| 6c | president photo replaced | PASS |
| 6d | photo position option applied | PASS |
| 6e | message page uses same text/photo/signature | PASS |
| 7a | venue saves | PASS |
| 7b | venue address/email/phone/title on public site | PASS |
| 7c | venue phone link | PASS |
| 8a | sponsor added with uploaded logo | PASS |
| 8b | sponsor edited | PASS |
| 8c | sponsor appears on homepage | PASS |
| 8d | sponsor website link | PASS |
| 8e | sponsor reorder reflected | PASS |
| 9a | application image uploaded + saved | PASS |
| 9b | application card uses uploaded image | PASS |
| 9c | application description shown | PASS |
| 10a | application information saves | PASS |
| 10b | application information on public site | PASS |
| 10c | protocol link updated | PASS |
| 10d | other bullets preserved | PASS |
| 11a | about saves | PASS |
| 11b | about text on public site | PASS |
| 11c | other about content preserved | PASS |
| 11d | about section hide + reorder | PASS |
| 12a | all four team tabs on public site | PASS |
| 12b | each tab shows its members | PASS |
| 12c | profile modal opens | PASS |
| 13a | team member added (Units tab, photo) | PASS |
| 13b | new member visible in Units tab | PASS |
| 14a | team photo uploaded and displayed | PASS |
| 13c | biography shown in profile | PASS |
| 13d | member role in Arabic | PASS |
| 13e | member edited + moved to another tab | PASS |
| 13f | moved member shows in Advisory Board with new role | PASS |
| 13g | member reorder reflected | PASS |
| 12d | tab rename reflected | PASS |
| 13h | member deleted | PASS |
| 17a | footer saves | PASS |
| 17b | footer email/social/copyright on every page | PASS |
| 18a | design settings save (admin) | PASS |
| 18b | global colours applied on public site | PASS |
| 18c | global font applied | PASS |
| 18d | design reset restores original colours | PASS |
| 5a | homepage section reorder + hide | PASS |
| 15a | Turkish text edited in "All texts" appears on site | PASS |
| 15b | English unchanged when only Turkish edited | PASS |
| 16a | admin Arabic interface with RTL | PASS |
| 16b | admin Turkish interface | PASS |
| 16c | public site language independent of admin language | PASS |
| M1 | media library lists uploaded images | PASS |
| M2 | unused image deleted from storage | PASS |
| 19/20 | all public pages load in EN/AR/TR with no JS errors | PASS |
| 22 | no broken images | PASS |
| 23 | no broken internal navigation links | PASS |
| 21a | team_members.sort_order + new columns exist | PASS |
| 21b | table site_texts readable publicly | PASS |
| 21b | table page_sections readable publicly | PASS |
| 21b | table team_groups readable publicly | PASS |

## Other checks
* **Reported bug reproduced and fixed:** I dropped `team_members.sort_order` (inside a transaction that was rolled back). A query then failed with `column "sort_order" does not exist`. After `cms-migration-v4.sql` ran, the column existed and all 17 members kept their data.
* **Migration is safe to repeat:** running it twice in a row gave no errors. The team back-fill created 10 groups and left 0 placements ungrouped.
* **Visual regression:** I compared full-page screenshots of the original and the new site with empty CMS tables, at 1280 px. About, Our Team, Applications and the lower Homepage (sponsors + footer) match pixel for pixel. The only differences in the Homepage hero were the moving video frame, the countdown seconds and the map iframe.
* **Console / images / links:** all 11 public pages load in EN, AR and TR with no JavaScript errors and no broken images. Every internal link resolves.
* **Admin UI:** all 14 dashboard pages open with no console errors in EN, AR (RTL) and TR. Tested at desktop width (1400 px) and mobile width (390 px), with no horizontal overflow.

## Not tested
* I couldn't log in to your **live** Supabase project: there's no admin account in it yet, and the migration hasn't been run there. The same files still need to be run there (see CMS-SETUP.md).
* Tests ran in Chromium only. Safari and Firefox weren't tested.
* Very large real photos: uploads are limited to 5 MB and are not resized or compressed.
