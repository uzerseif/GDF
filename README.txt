GDF'27 Certificate Verification System

Files: verify.html, certificate.html, verify.css, verify-common.js, verify.js, certificate.js,
assets/certificate-placeholder.svg, supabase-migration.sql
(They use the site's own style.css, i18n.css, translations.js, i18n.js and script.js.)

1. Upload all files to the same website directory and keep the assets and images folders.
2. Run supabase-migration.sql in the Supabase SQL Editor before deploying.
3. The Supabase URL and publishable/anon key are set once, in verify-common.js.
4. Upload original certificate images to the public gdf-certificates bucket (Supabase Dashboard)
   and save each image's public URL in certificates.certificate_image.
   If certificate_image is empty, assets/certificate-placeholder.svg is shown.
5. Texts: English is written in the HTML/JS, Arabic and Turkish are in translations.js
   (keys: verify.*, cert.*, nav.verify, title.verify, title.certificate).

Never place a service_role/secret key in frontend code. Browser rate limiting is not production-grade.
