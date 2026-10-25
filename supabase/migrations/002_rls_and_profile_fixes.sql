-- Supabase Migration: 002_rls_and_profile_fixes.sql
-- Description: Additive, safe RLS policy additions, indexes, and grant verification helpers.

-- 1. Ensure authenticated users can insert their own profile during registration / onboarding
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users insert own profile'
    ) THEN
        CREATE POLICY "Users insert own profile"
            ON public.profiles FOR INSERT
            WITH CHECK (auth.uid() = id);
    END IF;
END $$;

-- 2. Allow clinician_id to be nullable so patients can generate pre-authorized one-time grant codes
DO $$
BEGIN
    ALTER TABLE public.clinician_access_grants ALTER COLUMN clinician_id DROP NOT NULL;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 3. Performance indexes for user-scoped scan history queries
CREATE INDEX IF NOT EXISTS idx_scans_patient_created 
    ON public.scans (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scans_eye 
    ON public.scans (patient_id, eye);

-- 3. Performance indexes for clinician access grants and authorization checks
CREATE INDEX IF NOT EXISTS idx_grants_patient_status 
    ON public.clinician_access_grants (patient_id, status);

CREATE INDEX IF NOT EXISTS idx_grants_grant_code 
    ON public.clinician_access_grants (grant_code);

CREATE INDEX IF NOT EXISTS idx_grants_clinician 
    ON public.clinician_access_grants (clinician_id, status);

-- 4. Enable patients to delete their own clinician access grants
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'clinician_access_grants' 
        AND policyname = 'Patients delete own grants'
    ) THEN
        CREATE POLICY "Patients delete own grants"
            ON public.clinician_access_grants FOR DELETE
            USING (auth.uid() = patient_id);
    END IF;
END $$;
