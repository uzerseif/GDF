-- GDF'27 certificate details migration. Preserves existing certificate records.
ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS committee_name text,
  ADD COLUMN IF NOT EXISTS conference_name text DEFAULT 'GDF''27',
  ADD COLUMN IF NOT EXISTS represented_country text,
  ADD COLUMN IF NOT EXISTS performance_summary text,
  ADD COLUMN IF NOT EXISTS certificate_type text,
  ADD COLUMN IF NOT EXISTS certificate_image text;

-- Public read-only image bucket. Upload images via Supabase Dashboard; do not add public upload policies.
INSERT INTO storage.buckets (id, name, public)
VALUES ('gdf-certificates', 'gdf-certificates', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- RETURNS TABLE columns changed, so drop/recreate is required (CREATE OR REPLACE cannot change return type).
DROP FUNCTION IF EXISTS public.verify_certificate(text);
CREATE FUNCTION public.verify_certificate(p_cert_id text)
RETURNS TABLE (
  certificate_id text, recipient_name text, course_name text, committee_name text,
  conference_name text, represented_country text, performance_summary text,
  certificate_type text, certificate_image text, issue_date date, status text
)
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT c.certificate_id, c.recipient_name, c.course_name, c.committee_name,
    COALESCE(c.conference_name, 'GDF''27'), c.represented_country,
    c.performance_summary, c.certificate_type, c.certificate_image,
    c.issue_date, c.status
  FROM public.certificates c
  WHERE upper(trim(c.certificate_id)) = upper(trim(p_cert_id))
  LIMIT 1;
$function$;
REVOKE ALL ON FUNCTION public.verify_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
