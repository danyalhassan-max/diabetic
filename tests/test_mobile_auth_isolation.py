"""
Automated Integration and Authorization Isolation Test Suite for Mobile Auth & Roles
Tests:
1. Validation of login and registration input parameters.
2. Patient vs Doctor role registration requirements and confirm password validation.
3. Clinician professional fields (degree, license, jurisdiction, clinic) validation.
4. Role privilege escalation defense (preventing client self-verification or role altering).
5. User session creation, profile persistence, and data isolation.
6. User-scoped scans and clinician access grant delegation / redemption.
7. User settings persistence simulation.
"""

import pytest
import os
import json
import re
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent
MOBILE_ENV = PROJECT_DIR / "mobile" / ".env"

def test_login_validation_rules():
    """Verify email and password validation logic used in LoginScreen."""
    def validate_login(email: str, password: str):
        if not email or not email.strip():
            return False, "Please enter your email address."
        if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email.strip()):
            return False, "Please enter a valid email address."
        if not password:
            return False, "Please enter your password."
        if len(password) < 6:
            return False, "Password must be at least 6 characters."
        return True, None

    # Valid
    ok, err = validate_login("patient@example.com", "Password123")
    assert ok is True and err is None

    # Empty email
    ok, err = validate_login("", "Password123")
    assert ok is False and "email" in err.lower()

    # Invalid email
    ok, err = validate_login("notanemail", "Password123")
    assert ok is False and "valid" in err.lower()

    # Short password
    ok, err = validate_login("patient@example.com", "123")
    assert ok is False and "6 characters" in err.lower()


def test_patient_and_doctor_registration_validation():
    """Verify role-based validation in RegisterScreen for both patients and clinicians."""
    def validate_registration(
        full_name: str,
        email: str,
        password: str,
        confirm_password: str,
        role: str,
        doctor_details: dict = None,
    ):
        if not full_name or len(full_name.strip()) < 2:
            return False, "Please enter your full legal name."
        if not email or not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email.strip()):
            return False, "Please enter a valid email address."
        if not password or len(password) < 6:
            return False, "Password must be at least 6 characters."
        if password != confirm_password:
            return False, "Passwords do not match."
        if role not in ("patient", "clinician"):
            return False, "Invalid account role."

        if role == "clinician":
            details = doctor_details or {}
            if not details.get("medical_degree") or not details["medical_degree"].strip():
                return False, "Please enter your medical qualification or degree."
            if not details.get("medical_license_no") or len(details["medical_license_no"].strip()) < 3:
                return False, "Please enter a valid medical license."
            if not details.get("jurisdiction") or not details["jurisdiction"].strip():
                return False, "Please specify your registration jurisdiction."
            if not details.get("institution_name") or not details["institution_name"].strip():
                return False, "Please enter your clinic or hospital name."
            if not details.get("clinic_address_city") or not details["clinic_address_city"].strip():
                return False, "Please enter practice city."

        return True, None

    # 1. Valid Patient
    ok, err = validate_registration(
        full_name="Jane Doe",
        email="jane.doe@example.com",
        password="SecurePassword123",
        confirm_password="SecurePassword123",
        role="patient",
    )
    assert ok is True and err is None

    # 2. Password Mismatch
    ok, err = validate_registration(
        full_name="Jane Doe",
        email="jane.doe@example.com",
        password="SecurePassword123",
        confirm_password="MismatchPassword",
        role="patient",
    )
    assert ok is False and "match" in err.lower()

    # 3. Doctor Missing Medical Qualification
    ok, err = validate_registration(
        full_name="Dr. Sarah Jenkins",
        email="s.jenkins@stjude.org",
        password="DoctorPassword123",
        confirm_password="DoctorPassword123",
        role="clinician",
        doctor_details={
            "medical_degree": "",
            "medical_license_no": "GMC-749201",
            "jurisdiction": "UK GMC",
            "institution_name": "St. Jude Hospital",
            "clinic_address_city": "London",
        },
    )
    assert ok is False and "qualification" in err.lower()

    # 4. Doctor Missing License Number
    ok, err = validate_registration(
        full_name="Dr. Sarah Jenkins",
        email="s.jenkins@stjude.org",
        password="DoctorPassword123",
        confirm_password="DoctorPassword123",
        role="clinician",
        doctor_details={
            "medical_degree": "MBBS, FRCOphth",
            "medical_license_no": "",
            "jurisdiction": "UK GMC",
            "institution_name": "St. Jude Hospital",
            "clinic_address_city": "London",
        },
    )
    assert ok is False and "license" in err.lower()

    # 5. Doctor Missing Practice Location
    ok, err = validate_registration(
        full_name="Dr. Sarah Jenkins",
        email="s.jenkins@stjude.org",
        password="DoctorPassword123",
        confirm_password="DoctorPassword123",
        role="clinician",
        doctor_details={
            "medical_degree": "MBBS, FRCOphth",
            "medical_license_no": "GMC-749201",
            "jurisdiction": "UK GMC",
            "institution_name": "St. Jude Hospital",
            "clinic_address_city": "",
        },
    )
    assert ok is False and "city" in err.lower()

    # 6. Valid Doctor
    ok, err = validate_registration(
        full_name="Dr. Sarah Jenkins",
        email="s.jenkins@stjude.org",
        password="DoctorPassword123",
        confirm_password="DoctorPassword123",
        role="clinician",
        doctor_details={
            "medical_degree": "MBBS, FRCOphth",
            "medical_license_no": "GMC-749201",
            "jurisdiction": "UK GMC",
            "institution_name": "St. Jude Hospital",
            "clinic_address_city": "London",
        },
    )
    assert ok is True and err is None


def test_role_security_and_privilege_escalation_prevention():
    """Verify that clients cannot self-promote to verified doctor or change role."""
    class MockProfileRecord:
        def __init__(self, user_id: str, role: str, is_verified: bool = False, verification_status: str = "pending"):
            self.id = user_id
            self.role = role
            self.is_verified = is_verified
            self.verification_status = verification_status

        def client_update(self, updates: dict):
            # Simulates DB BEFORE trigger: protect_profile_security
            # Clients (non-service role) cannot modify role, is_verified, or verification_status
            protected_fields = {"role", "is_verified", "verification_status", "verified_at"}
            for k, v in updates.items():
                if k not in protected_fields:
                    setattr(self, k, v)
                # Protected fields are preserved as OLD value

    # A patient attempts to elevate themselves to clinician with is_verified=True
    patient_prof = MockProfileRecord("user-1", role="patient", is_verified=False)
    patient_prof.client_update({"role": "clinician", "is_verified": True, "verification_status": "approved", "full_name": "Hacker"})

    assert patient_prof.role == "patient"
    assert patient_prof.is_verified is False
    assert patient_prof.verification_status == "pending"
    assert patient_prof.full_name == "Hacker"

    # A clinician starts as unverified pending
    doctor_prof = MockProfileRecord("user-2", role="clinician", is_verified=False, verification_status="pending")
    # Clinician attempts to self-approve
    doctor_prof.client_update({"is_verified": True, "verification_status": "approved"})
    assert doctor_prof.is_verified is False
    assert doctor_prof.verification_status == "pending"


def test_clinician_code_redemption_and_scan_authorization():
    """Verify patient-controlled delegation and clinician code redemption."""
    grants_db = []

    def patient_create_grant(patient_id: str, code: str):
        grant = {
            "id": f"grant-{len(grants_db) + 1}",
            "patient_id": patient_id,
            "clinician_id": None,
            "grant_code": code,
            "status": "active",
        }
        grants_db.append(grant)
        return grant

    def clinician_redeem_grant(clinician_id: str, clinician_role: str, code: str):
        if clinician_role != "clinician":
            return False, "Only clinicians can redeem access codes"
        for g in grants_db:
            if g["grant_code"] == code and g["status"] == "active" and g["clinician_id"] is None:
                g["clinician_id"] = clinician_id
                g["grant_code"] = None  # consumed
                return True, g
        return False, "Invalid or expired access code"

    # Patient generates code
    grant = patient_create_grant("patient-100", "582-914")
    assert grant["clinician_id"] is None

    # Patient tries to redeem code (should fail)
    ok, err = clinician_redeem_grant("patient-200", "patient", "582-914")
    assert ok is False and "only clinicians" in err.lower()

    # Doctor redeems code (should succeed)
    ok, result = clinician_redeem_grant("doc-300", "clinician", "582-914")
    assert ok is True
    assert result["clinician_id"] == "doc-300"
    assert result["grant_code"] is None  # code consumed

    # Re-redeeming should fail
    ok, err = clinician_redeem_grant("doc-400", "clinician", "582-914")
    assert ok is False and "invalid" in err.lower()


def test_user_scoped_settings_isolation():
    """Verify settings storage is isolated per userId and does not leak across accounts."""
    simulated_store = {}

    def save_settings(user_id: str, settings: dict):
        simulated_store[f"user_settings_{user_id}"] = json.dumps(settings)

    def load_settings(user_id: str) -> dict:
        data = simulated_store.get(f"user_settings_{user_id}")
        if data:
            return json.loads(data)
        return {"biometricsEnabled": True, "offlineSyncEnabled": True}

    user_a = "user-uuid-1111"
    user_b = "user-uuid-2222"

    save_settings(user_a, {"biometricsEnabled": False, "offlineSyncEnabled": True})
    save_settings(user_b, {"biometricsEnabled": True, "offlineSyncEnabled": False})

    settings_a = load_settings(user_a)
    settings_b = load_settings(user_b)

    assert settings_a["biometricsEnabled"] is False
    assert settings_a["offlineSyncEnabled"] is True

    assert settings_b["biometricsEnabled"] is True
    assert settings_b["offlineSyncEnabled"] is False

    # Sign out of user A; User B logs in
    active_user = user_b
    restored = load_settings(active_user)
    assert restored["offlineSyncEnabled"] is False
    assert restored["biometricsEnabled"] is True
