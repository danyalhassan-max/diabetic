-- Supabase PostgreSQL 16 Schema Migration: Diabetic Retinopathy Diagnostic System
-- Version: 001_initial_schema.sql
-- Description: Core tables, RLS policies, clinician authorization grants, and private storage isolation.

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('patient', 'clinician')),
    full_name TEXT NOT NULL,
    phone_number TEXT,
    avatar_url TEXT,
    medical_license_no TEXT,
    institution_name TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-create profile on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, role, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. SCANS TABLE
CREATE TABLE IF NOT EXISTS public.scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    eye TEXT NOT NULL CHECK (eye IN ('OD', 'OS', 'OU')), -- OD: Right, OS: Left, OU: Both
    storage_path TEXT NOT NULL,
    grade INTEGER NOT NULL CHECK (grade BETWEEN 0 AND 4),
    label TEXT NOT NULL,
    probabilities JSONB NOT NULL,
    model_version TEXT NOT NULL DEFAULT 'densenet121_ordinal_v1',
    patient_notes TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CLINICIAN ACCESS GRANTS (Patient-authorized delegation)
CREATE TABLE IF NOT EXISTS public.clinician_access_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    clinician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'expired')) DEFAULT 'active',
    grant_code TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CLINICIAN REVIEWS & SECOND OPINIONS
CREATE TABLE IF NOT EXISTS public.clinician_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
    clinician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    confirmed_grade INTEGER CHECK (confirmed_grade BETWEEN 0 AND 4),
    review_notes TEXT NOT NULL,
    clinical_recommendation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. FOLLOW-UP REMINDERS
CREATE TABLE IF NOT EXISTS public.follow_up_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    scan_id UUID REFERENCES public.scans(id) ON DELETE SET NULL,
    reminder_date DATE NOT NULL,
    note TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinician_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinician_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_reminders ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Patients view verified clinicians"
    ON public.profiles FOR SELECT
    USING (role = 'clinician' AND is_verified = TRUE);

-- Scans Policies (Patient owns scan; Clinician accesses only with active grant)
CREATE POLICY "Patients view own scans"
    ON public.scans FOR SELECT
    USING (auth.uid() = patient_id);

CREATE POLICY "Patients insert own scans"
    ON public.scans FOR INSERT
    WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients update own scans"
    ON public.scans FOR UPDATE
    USING (auth.uid() = patient_id);

CREATE POLICY "Patients delete own scans"
    ON public.scans FOR DELETE
    USING (auth.uid() = patient_id);

CREATE POLICY "Authorized clinicians view patient scans"
    ON public.scans FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.clinician_access_grants g
            WHERE g.patient_id = scans.patient_id
              AND g.clinician_id = auth.uid()
              AND g.status = 'active'
              AND g.expires_at > NOW()
        )
    );

-- Clinician Access Grants Policies
CREATE POLICY "Patients manage their grants"
    ON public.clinician_access_grants FOR ALL
    USING (auth.uid() = patient_id);

CREATE POLICY "Clinicians view assigned grants"
    ON public.clinician_access_grants FOR SELECT
    USING (auth.uid() = clinician_id);

-- Clinician Reviews Policies
CREATE POLICY "Patients view reviews on their scans"
    ON public.clinician_reviews FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.scans s
            WHERE s.id = clinician_reviews.scan_id
              AND s.patient_id = auth.uid()
        )
    );

CREATE POLICY "Clinicians create reviews for authorized scans"
    ON public.clinician_reviews FOR INSERT
    WITH CHECK (
        auth.uid() = clinician_id AND
        EXISTS (
            SELECT 1 FROM public.scans s
            JOIN public.clinician_access_grants g ON g.patient_id = s.patient_id
            WHERE s.id = scan_id
              AND g.clinician_id = auth.uid()
              AND g.status = 'active'
              AND g.expires_at > NOW()
        )
    );

CREATE POLICY "Clinicians view their own reviews"
    ON public.clinician_reviews FOR SELECT
    USING (auth.uid() = clinician_id);

-- Follow-Up Reminders Policies
CREATE POLICY "Patients manage own reminders"
    ON public.follow_up_reminders FOR ALL
    USING (auth.uid() = patient_id);

-- ==============================================================================
-- STORAGE CONFIGURATION (Bucket: retinal-scans)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('retinal-scans', 'retinal-scans', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: Patients can upload to their own user folder
CREATE POLICY "Patients upload own scans to storage"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'retinal-scans' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Storage Policy: Patients can view their own files
CREATE POLICY "Patients read own scans from storage"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'retinal-scans' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Storage Policy: Authorized clinicians can read patient files
CREATE POLICY "Authorized clinicians read patient scans from storage"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'retinal-scans' AND
        EXISTS (
            SELECT 1 FROM public.clinician_access_grants g
            WHERE g.patient_id::text = (storage.foldername(name))[1]
              AND g.clinician_id = auth.uid()
              AND g.status = 'active'
              AND g.expires_at > NOW()
        )
    );
