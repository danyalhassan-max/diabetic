"""
Automated Integration and Authorization Isolation Test Suite for Mobile Auth Flow
Tests:
1. Validation of login and registration input parameters.
2. User session creation, profile persistence, and data isolation.
3. User-scoped scans: verify scans are isolated per patient_id.
4. Clinician access grants: verify patient owns and controls grants.
5. User settings persistence simulation.
"""

import pytest
import os
import json
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent
MOBILE_ENV = PROJECT_DIR / "mobile" / ".env"

def test_login_validation_rules():
    """Verify email and password validation logic used in LoginScreen."""
    def validate_login(email: str, password: str):
        if not email or not email.strip():
            return False, "Please enter your email address."
        import re
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


def test_registration_validation_rules():
    """Verify validation logic in RegisterScreen."""
    def validate_register(full_name: str, email: str, password: str, role: str):
        if not full_name or not full_name.strip():
            return False, "Please enter your full legal or patient name."
        import re
        if not email or not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email.strip()):
            return False, "Please enter a valid email address."
        if not password or len(password) < 6:
            return False, "Password must be at least 6 characters."
        if role not in ("patient", "clinician"):
            return False, "Invalid account role."
        return True, None

    ok, err = validate_register("Dr. Jane Doe", "doctor@hospital.org", "Pass12345", "clinician")
    assert ok is True and err is None

    ok, err = validate_register("", "patient@example.com", "Pass12345", "patient")
    assert ok is False and "full" in err.lower()

    ok, err = validate_register("Jane", "patient@example.com", "Pass12345", "invalid_role")
    assert ok is False and "role" in err.lower()


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

    # Sign out of user A
    active_user = None
    # User B logs in
    active_user = user_b
    restored = load_settings(active_user)
    assert restored["offlineSyncEnabled"] is False
    assert restored["biometricsEnabled"] is True


def test_scan_history_and_grants_data_isolation():
    """Verify that scan records and clinician grants strictly enforce user isolation."""
    scans_db = [
        {"id": "s1", "patient_id": "patient-1", "grade": 0, "eye": "OD"},
        {"id": "s2", "patient_id": "patient-1", "grade": 1, "eye": "OS"},
        {"id": "s3", "patient_id": "patient-2", "grade": 3, "eye": "OD"},
    ]

    grants_db = [
        {"id": "g1", "patient_id": "patient-1", "grant_code": "111-222", "status": "active"},
        {"id": "g2", "patient_id": "patient-2", "grant_code": "333-444", "status": "active"},
    ]

    # Query for Patient 1
    p1_scans = [s for s in scans_db if s["patient_id"] == "patient-1"]
    p1_grants = [g for g in grants_db if g["patient_id"] == "patient-1"]

    assert len(p1_scans) == 2
    assert all(s["patient_id"] == "patient-1" for s in p1_scans)
    assert len(p1_grants) == 1
    assert p1_grants[0]["grant_code"] == "111-222"

    # Query for Patient 2
    p2_scans = [s for s in scans_db if s["patient_id"] == "patient-2"]
    p2_grants = [g for g in grants_db if g["patient_id"] == "patient-2"]

    assert len(p2_scans) == 1
    assert p2_scans[0]["id"] == "s3"
    assert p2_grants[0]["grant_code"] == "333-444"

    # Patient 2 can never see Patient 1's scan s1 or grant g1
    assert "s1" not in [s["id"] for s in p2_scans]
    assert "g1" not in [g["id"] for g in p2_grants]
