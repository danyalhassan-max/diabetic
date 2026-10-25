# PRODUCTION DEPLOYMENT & RELEASE READINESS GUIDE

**Application:** Diabetic Retinopathy Diagnostic API & Cloud Backend  
**Release Version:** `v1.0.0` (Milestone 7)  
**Date:** October 24, 2026  

---

## 1. Overview & Architecture

The production backend runs as an isolated, containerized microservice serving the pre-trained DenseNet-121 model (`retfound_model.keras`), integrated with Supabase for PostgreSQL data, authentication, and private encrypted image storage.

```
[ Mobile / Web Clients ]
         │
         ├── (Bearer JWT / HTTPS)
         ▼
[ Flask Inference Container ] ── (In-Memory Inference) ──> [ DenseNet-121 Model ]
         │
         ├── (Supabase Client SDK)
         ▼
[ Supabase Managed Cloud ] ── (PostgreSQL 16 + RLS + Private Storage Bucket)
```

---

## 2. Docker Container Deployment

### 2.1 Build the Production Image
```bash
docker build -t diabetic-retina-api:1.0.0 .
```

### 2.2 Run with Docker Compose
```bash
# Copy and configure environment variables
cp .env.example .env

# Start container in detached mode
docker compose up -d

# Check live logs
docker compose logs -f retina-api
```

### 2.3 Verify Container Health
```bash
# Check container status and health state
docker ps --filter "name=diabetic-retinopathy-api"

# Query health check endpoint
curl -f http://localhost:5000/api/health
```
Expected output:
```json
{
  "auth_enforced": false,
  "model_loaded": true,
  "model_version": "densenet121_ordinal_v1",
  "status": "healthy"
}
```

---

## 3. Cloud Provider Deployments

### Option A: Google Cloud Run (Recommended for ML Microservices)
1. Authenticate with Google Cloud:
   ```bash
   gcloud auth configure-docker
   ```
2. Tag and push to Google Artifact Registry:
   ```bash
   docker tag diabetic-retina-api:1.0.0 gcr.io/<PROJECT_ID>/diabetic-retina-api:1.0.0
   docker push gcr.io/<PROJECT_ID>/diabetic-retina-api:1.0.0
   ```
3. Deploy to Cloud Run with required memory allocation:
   ```bash
   gcloud run deploy diabetic-retina-api \
     --image gcr.io/<PROJECT_ID>/diabetic-retina-api:1.0.0 \
     --platform managed \
     --region us-central1 \
     --memory 2Gi \
     --cpu 2 \
     --min-instances 1 \
     --max-instances 10 \
     --set-env-vars "SUPABASE_JWT_SECRET=<YOUR_SECRET>,GEMINI_API_KEY=<YOUR_GEMINI_KEY>,GEMINI_MODEL=gemini-2.5-flash,ENABLE_GEMINI_VALIDATION=true" \
     --allow-unauthenticated
   ```
   *(Note: Set `--min-instances 1` to eliminate cold-start latency from TensorFlow model loading).*

### Option B: Render / Railway
1. Connect your GitHub repository to Render / Railway.
2. Select **Web Service** with runtime **Docker**.
3. Configure instance type: **Standard (2 GB RAM, 1 CPU minimum)**.
4. Set Environment Variables:
   - `PORT=5000`
   - `RETINA_MODEL_PATH=/app/retfound_model.keras`
   - `SUPABASE_JWT_SECRET=<YOUR_SUPABASE_JWT_SECRET>`
   - `GEMINI_API_KEY=<YOUR_GEMINI_API_KEY>`
   - `GEMINI_MODEL=gemini-2.5-flash`
   - `ENABLE_GEMINI_VALIDATION=true`
   - `GEMINI_TIMEOUT_SECONDS=10`
   - `GUNICORN_WORKERS=2`
5. Set Health Check Path: `/api/health`.

---

## 4. Supabase Database & Storage Deployment

1. **Access Supabase Dashboard:**
   - Navigate to your production project at [database.new](https://database.new).
2. **Execute Schema Migration:**
   - Open **SQL Editor**.
   - Paste and execute the contents of [`supabase/migrations/001_initial_schema.sql`](file:///s:/unimate/diabetic/supabase/migrations/001_initial_schema.sql).
3. **Verify Row Level Security (RLS):**
   - Confirm that tables `profiles`, `scans`, `clinician_access_grants`, `clinician_reviews`, and `follow_up_reminders` have **RLS Enabled**.
4. **Verify Storage Bucket:**
   - Confirm bucket `retinal-scans` is present and flagged as **Private**.
   - Confirm that policies `Patients upload own scans`, `Patients read own scans`, and `Authorized clinicians read patient scans` are active.
5. **Retrieve API Secret:**
   - Go to **Project Settings** -> **API** -> **JWT Settings**.
   - Copy the **JWT Secret** and set it as `SUPABASE_JWT_SECRET` in your container environment to enforce token authentication.

---

## 5. Security & Operational Checklist

| Item | Status | Verification Method |
| :--- | :--- | :--- |
| **Non-Root Container** | Passed | Dockerfile executes under `appuser` (UID 1000). |
| **Model Immutability** | Passed | `retfound_model.keras` is read-only inside the container. |
| **JWT Bearer Enforcement** | Ready | Validates Supabase JWT signature when `SUPABASE_JWT_SECRET` is set. |
| **CORS Domain Restriction** | Ready | Pre-configured via `flask-cors`. In production, set specific frontend origins. |
| **Resource Isolation** | Passed | `docker-compose.yml` caps memory at 2.5 GB to prevent host starvation. |
| **Continuous Healthchecks** | Passed | Docker `HEALTHCHECK` queries `/api/health` every 30 seconds. |
| **Graceful Shutdown** | Passed | Gunicorn handles `SIGTERM` with 30s graceful timeout. |

---

## 6. Smoke Test & Regression Verification

Run the automated regression test suite locally before any release:
```bash
.venv\Scripts\pytest -v
```
All 10 test cases must pass:
```text
tests/test_api.py::test_html_index PASSED
tests/test_api.py::test_api_health PASSED
tests/test_api.py::test_api_predict_multipart PASSED
tests/test_api.py::test_api_predict_base64 PASSED
tests/test_api.py::test_api_predict_no_image PASSED
tests/test_api.py::test_cors_headers PASSED
tests/test_model.py::test_model_loaded PASSED
tests/test_model.py::test_predict_grade_dummy_image PASSED
tests/test_model.py::test_predict_invalid_image PASSED
tests/test_model.py::test_all_zeros_threshold_edge_case PASSED
```
