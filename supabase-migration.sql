
-- =====================================================
-- GDF'27 CERTIFICATE VERIFICATION SYSTEM
-- Complete Supabase SQL Setup
-- =====================================================

-- 1. CREATE CERTIFICATES TABLE
CREATE TABLE IF NOT EXISTS public.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    certificate_id TEXT NOT NULL UNIQUE,
    recipient_name TEXT NOT NULL,

    course_name TEXT,
    committee_name TEXT,
    conference_name TEXT DEFAULT 'GDF''27',

    represented_country TEXT,
    performance_summary TEXT,

    certificate_type TEXT,
    certificate_image TEXT,

    issue_date DATE,
    status TEXT NOT NULL DEFAULT 'valid',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 2. NORMALIZE STATUS AUTOMATICALLY
-- Accepts Valid, VALID, valid, etc.
-- Stores all statuses in lowercase.

CREATE OR REPLACE FUNCTION public.normalize_certificate_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.status := lower(trim(NEW.status));
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_certificate_status
ON public.certificates;

CREATE TRIGGER trg_normalize_certificate_status
BEFORE INSERT OR UPDATE OF status
ON public.certificates
FOR EACH ROW
EXECUTE FUNCTION public.normalize_certificate_status();


-- 3. FIX EXISTING STATUS VALUES

UPDATE public.certificates
SET status = lower(trim(status));


-- 4. STATUS VALIDATION

ALTER TABLE public.certificates
DROP CONSTRAINT IF EXISTS certificates_status_check;

ALTER TABLE public.certificates
ADD CONSTRAINT certificates_status_check
CHECK (status IN ('valid', 'revoked', 'expired'));


-- 5. CREATE INDEXES

CREATE INDEX IF NOT EXISTS idx_certificates_certificate_id
ON public.certificates (certificate_id);

CREATE INDEX IF NOT EXISTS idx_certificates_recipient_name
ON public.certificates (recipient_name);

CREATE INDEX IF NOT EXISTS idx_certificates_status
ON public.certificates (status);


-- 6. AUTO UPDATE updated_at

CREATE OR REPLACE FUNCTION public.update_certificate_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_certificate_timestamp
ON public.certificates;

CREATE TRIGGER trg_update_certificate_timestamp
BEFORE UPDATE
ON public.certificates
FOR EACH ROW
EXECUTE FUNCTION public.update_certificate_timestamp();


-- 7. ENABLE ROW LEVEL SECURITY

ALTER TABLE public.certificates
ENABLE ROW LEVEL SECURITY;

-- No public INSERT, UPDATE, DELETE, or direct SELECT policies.
-- Public verification is provided through the function below.


-- 8. CREATE STORAGE BUCKET

INSERT INTO storage.buckets (id, name, public)
VALUES ('gdf-certificates', 'gdf-certificates', TRUE)
ON CONFLICT (id)
DO UPDATE SET public = TRUE;


-- 9. STORAGE POLICY
-- Allows public viewing of files in this bucket only.
-- Uploads and deletion should be handled by a trusted admin.

DROP POLICY IF EXISTS "Public can view GDF certificates"
ON storage.objects;

CREATE POLICY "Public can view GDF certificates"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'gdf-certificates');


-- 10. PUBLIC CERTIFICATE VERIFICATION FUNCTION

CREATE OR REPLACE FUNCTION public.verify_certificate(
    p_certificate_id TEXT
)
RETURNS TABLE (
    certificate_id TEXT,
    recipient_name TEXT,
    course_name TEXT,
    committee_name TEXT,
    conference_name TEXT,
    represented_country TEXT,
    performance_summary TEXT,
    certificate_type TEXT,
    certificate_image TEXT,
    issue_date DATE,
    status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        c.certificate_id,
        c.recipient_name,
        c.course_name,
        c.committee_name,
        c.conference_name,
        c.represented_country,
        c.performance_summary,
        c.certificate_type,
        c.certificate_image,
        c.issue_date,
        c.status
    FROM public.certificates AS c
    WHERE c.certificate_id = trim(p_certificate_id)
    LIMIT 1;
$$;


-- 11. FUNCTION PERMISSIONS

REVOKE ALL ON FUNCTION public.verify_certificate(TEXT)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.verify_certificate(TEXT)
TO anon, authenticated;


-- =====================================================
-- SETUP COMPLETE
-- =====================================================
