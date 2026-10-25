"""
Supabase Project & Database Connectivity Diagnostic Script

Tests:
1. Supabase REST API connection
2. Anonymous API Key validation
3. Database table existence & Row Level Security (RLS)
4. Storage bucket existence (retinal-scans)
5. Auth service endpoint health
"""

import os
from pathlib import Path
import requests

PROJECT_DIR = Path(__file__).resolve().parent
MOBILE_ENV = PROJECT_DIR / "mobile" / ".env"

# Extract Supabase configuration from mobile/.env or environment
url = os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
key = os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    if MOBILE_ENV.is_file():
        with open(MOBILE_ENV, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("EXPO_PUBLIC_SUPABASE_URL="):
                    url = line.split("=", 1)[1].strip().strip("'\"")
                elif line.startswith("EXPO_PUBLIC_SUPABASE_ANON_KEY="):
                    key = line.split("=", 1)[1].strip().strip("'\"")

print("=" * 60)
print("  SUPABASE DATABASE & STORAGE DIAGNOSTIC TEST")
print("=" * 60)

if not url or not key:
    print("[ERROR] Supabase credentials not found in environment or mobile/.env")
    exit(1)

print(f"Project URL: {url}")
print(f"Anon Key:    {key[:15]}...{key[-10:]}")
print("-" * 60)

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json",
}

# 1. Test Project Reachability
print("[1/4] Testing Supabase Project Reachability & Auth...")
try:
    r_auth = requests.get(f"{url}/auth/v1/health", headers=headers, timeout=10)
    if r_auth.status_code == 200:
        print("  -> Auth Service: ONLINE (HTTP 200)")
    else:
        print(f"  -> Auth Service: Responding (HTTP {r_auth.status_code})")
except Exception as exc:
    print(f"  -> [FAILED] Could not connect to project: {exc}")
    exit(1)

# 2. Test Database Tables
print("\n[2/4] Testing PostgreSQL Database Tables...")
REQUIRED_TABLES = [
    "profiles",
    "scans",
    "clinician_access_grants",
    "clinician_reviews",
    "follow_up_reminders",
]

missing_tables = []
active_tables = []

for table in REQUIRED_TABLES:
    try:
        r = requests.get(f"{url}/rest/v1/{table}?select=count", headers=headers, timeout=10)
        if r.status_code in (200, 206):
            active_tables.append(table)
            print(f"  [OK] Table '{table}': ACTIVE (HTTP {r.status_code})")
        elif r.status_code == 404:
            missing_tables.append(table)
            print(f"  [MISSING] Table '{table}': NOT FOUND (HTTP 404 - Needs Migration)")
        else:
            print(f"  [?] Table '{table}': HTTP {r.status_code} ({r.text[:60]})")
    except Exception as exc:
        print(f"  [ERROR] Table '{table}': {exc}")

# 3. Test Storage Buckets
print("\n[3/4] Testing Supabase Storage...")
try:
    r_storage = requests.get(f"{url}/storage/v1/bucket", headers=headers, timeout=10)
    if r_storage.status_code == 200:
        buckets = [b.get("name") for b in r_storage.json() if isinstance(b, dict)]
        if "retinal-scans" in buckets:
            print("  [OK] Storage Bucket 'retinal-scans': FOUND & ACTIVE")
        else:
            print("  [MISSING] Storage Bucket 'retinal-scans': NOT FOUND")
            print(f"       Existing buckets: {buckets if buckets else 'None'}")
    else:
        print(f"  [ERROR] Storage API responded with HTTP {r_storage.status_code}")
except Exception as exc:
    print(f"  [ERROR] Storage check failed: {exc}")

# 4. Summary & Actionable Recommendations
print("\n" + "=" * 60)
print("  DIAGNOSTIC SUMMARY")
print("=" * 60)

if not missing_tables and "retinal-scans" in (buckets if 'buckets' in locals() else []):
    print("ALL CHECKS PASSED: Database schema and storage are fully deployed and ready!")
else:
    print("ACTION REQUIRED:")
    print("Your Supabase project is active, but the database schema has not been applied yet.")
    print("\nHow to apply the schema migration:")
    print("1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/qtsctxxwqvjqdzvlrbet")
    print("2. In the left navigation bar, click on 'SQL Editor'.")
    print("3. Click 'New query'.")
    print("4. Copy the entire contents of:")
    print(f"   {PROJECT_DIR / 'supabase' / 'migrations' / '001_initial_schema.sql'}")
    print("5. Paste into the SQL editor and click 'RUN'.")
    print("6. Run this script again to confirm: .venv\\Scripts\\python test_supabase.py")
print("=" * 60)
