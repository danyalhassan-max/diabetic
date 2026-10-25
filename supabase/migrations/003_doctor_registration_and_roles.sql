-- Supabase PostgreSQL Migration: 003_doctor_registration_and_roles.sql
-- Description: Adds professional clinician fields, strict role and verification protection triggers,
--              grant redemption RPC, and verification workflow support.

-- 1. ADD CLINICIAN PROFESSIONAL FIELDS TO PROFILES TABLE
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS medical_degree TEXT,
    ADD COLUMN IF NOT EXISTS specialty TEXT,
    ADD COLUMN IF NOT EXISTS jurisdiction TEXT,
    ADD COLUMN IF NOT EXISTS clinic_address_city TEXT,
    ADD COLUMN IF NOT EXISTS years_of_experience INTEGER,
    ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending'
        CHECK (verification_status IN ('pending', 'approved', 'rejected'));

-- Backfill verification_status for existing records
UPDATE public.profiles
SET verification_status = 'approved'
WHERE is_verified = TRUE AND verification_status = 'pending';

-- 2. SECURE TRIGGER TO PREVENT CLIENT-SIDE PRIVILEGE ESCALATION
-- Prevents clients from self-verifying, self-promoting roles, or modifying protected verification fields.
CREATE OR REPLACE FUNCTION public.protect_profile_security()
RETURNS TRIGGER AS $$
DECLARE
    is_admin_or_service BOOLEAN;
BEGIN
    -- Determine if caller is service_role or database superuser
    is_admin_or_service := (
        COALESCE(auth.jwt()->>'role', '') = 'service_role' 
        OR current_user = 'postgres'
    );

    IF TG_OP = 'INSERT' THEN
        -- New profiles always default to unverified unless created by service role
        IF NOT is_admin_or_service THEN
            NEW.is_verified := FALSE;
            NEW.verified_at := NULL;
            NEW.verification_status := 'pending';
        ELSE
            IF NEW.verification_status = 'approved' THEN
                NEW.is_verified := TRUE;
                NEW.verified_at := COALESCE(NEW.verified_at, NOW());
            ELSE
                NEW.is_verified := FALSE;
                NEW.verified_at := NULL;
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- If regular client is updating, prevent changing role or verification state
        IF NOT is_admin_or_service THEN
            NEW.role := OLD.role;
            NEW.is_verified := OLD.is_verified;
            NEW.verified_at := OLD.verified_at;
            NEW.verification_status := OLD.verification_status;
        ELSE
            -- Admin / service role update: keep is_verified and verification_status synchronized
            IF NEW.verification_status = 'approved' THEN
                NEW.is_verified := TRUE;
                NEW.verified_at := COALESCE(NEW.verified_at, NOW());
            ELSIF NEW.verification_status IN ('pending', 'rejected') THEN
                NEW.is_verified := FALSE;
                NEW.verified_at := NULL;
            END IF;
        END IF;

        NEW.updated_at := NOW();
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_security ON public.profiles;
CREATE TRIGGER trg_protect_profile_security
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_security();

-- 3. CLINICIAN GRANT REDEMPTION RPC FUNCTION
-- Allows authenticated clinicians to redeem a patient's one-time grant code
CREATE OR REPLACE FUNCTION public.redeem_clinician_grant(p_grant_code TEXT)
RETURNS jsonb AS $$
DECLARE
    v_grant public.clinician_access_grants%ROWTYPE;
    v_clinician_role TEXT;
    v_clean_code TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required to redeem access code';
    END IF;

    -- Verify caller has clinician role in public.profiles
    SELECT role INTO v_clinician_role 
    FROM public.profiles 
    WHERE id = auth.uid();

    IF v_clinician_role IS DISTINCT FROM 'clinician' THEN
        RAISE EXCEPTION 'Only clinician accounts are authorized to redeem patient access codes';
    END IF;

    v_clean_code := TRIM(p_grant_code);

    -- Find matching active, unexpired, unclaimed grant
    SELECT * INTO v_grant
    FROM public.clinician_access_grants
    WHERE grant_code = v_clean_code
      AND status = 'active'
      AND expires_at > NOW()
      AND clinician_id IS NULL
    LIMIT 1;

    IF v_grant.id IS NULL THEN
        RAISE EXCEPTION 'Access code is invalid, expired, or has already been redeemed.';
    END IF;

    -- Prevent self-grant (if patient and clinician were same ID in tests)
    IF v_grant.patient_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot redeem your own patient access code as a clinician.';
    END IF;

    -- Assign clinician and clear grant code to consume it
    UPDATE public.clinician_access_grants
    SET 
        clinician_id = auth.uid(),
        grant_code = NULL
    WHERE id = v_grant.id;

    RETURN jsonb_build_object(
        'success', true, 
        'grant_id', v_grant.id, 
        'patient_id', v_grant.patient_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RLS POLICIES FOR GRANT REDEMPTION AND UNVERIFIED CLINICIANS
-- Allow clinicians to update unclaimed grants using matching grant code
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'clinician_access_grants' 
        AND policyname = 'Clinicians claim active grant with code'
    ) THEN
        CREATE POLICY "Clinicians claim active grant with code"
            ON public.clinician_access_grants FOR UPDATE
            USING (
                clinician_id IS NULL 
                AND status = 'active' 
                AND expires_at > NOW()
                AND EXISTS (
                    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'clinician'
                )
            )
            WITH CHECK (
                clinician_id = auth.uid()
            );
    END IF;
END $$;

-- Enforce that only verified clinicians can create official clinical reviews
DROP POLICY IF EXISTS "Clinicians create reviews for authorized scans" ON public.clinician_reviews;
CREATE POLICY "Clinicians create reviews for authorized scans"
    ON public.clinician_reviews FOR INSERT
    WITH CHECK (
        auth.uid() = clinician_id AND
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND role = 'clinician' 
              AND is_verified = TRUE
        ) AND
        EXISTS (
            SELECT 1 FROM public.scans s
            JOIN public.clinician_access_grants g ON g.patient_id = s.patient_id
            WHERE s.id = scan_id
              AND g.clinician_id = auth.uid()
              AND g.status = 'active'
              AND g.expires_at > NOW()
        )
    );

-- 5. MINIMAL ADMINISTRATIVE APPROVAL HELPER (Service Role / Admin only)
CREATE OR REPLACE FUNCTION public.admin_set_clinician_verification(
    p_clinician_id UUID,
    p_status TEXT -- 'approved', 'rejected', or 'pending'
)
RETURNS jsonb AS $$
DECLARE
    is_admin_or_service BOOLEAN;
BEGIN
    is_admin_or_service := (
        COALESCE(auth.jwt()->>'role', '') = 'service_role' 
        OR current_user = 'postgres'
    );

    IF NOT is_admin_or_service THEN
        RAISE EXCEPTION 'Unauthorized: only service role or administrators can verify clinicians.';
    END IF;

    IF p_status NOT IN ('approved', 'rejected', 'pending') THEN
        RAISE EXCEPTION 'Invalid verification status. Must be approved, rejected, or pending.';
    END IF;

    UPDATE public.profiles
    SET 
        verification_status = p_status,
        is_verified = (p_status = 'approved'),
        verified_at = CASE WHEN p_status = 'approved' THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_clinician_id AND role = 'clinician';

    RETURN jsonb_build_object('success', true, 'clinician_id', p_clinician_id, 'status', p_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
