---
title: Diabetic Retinopathy Diagnostic API
emoji: 👁️
colorFrom: teal
colorTo: blue
sdk: docker
app_port: 7860
---

# Diabetic Retinopathy Diagnostic API

Deep learning inference service serving a DenseNet-121 retinal classification model for grading Diabetic Retinopathy (DR).

## Overview
- **Framework**: Flask + TensorFlow 2.16
- **Architecture**: DenseNet-121 (Ordinal DR Classification)
- **Validation Gate**: Google Gemini API (`google-genai` SDK)
- **Model File**: `retfound_model.keras`
- **Output Classes**:
  - `0`: No diabetic retinopathy
  - `1`: Mild non-proliferative diabetic retinopathy
  - `2`: Moderate non-proliferative diabetic retinopathy
  - `3`: Severe non-proliferative diabetic retinopathy
  - `4`: Proliferative diabetic retinopathy

## Pre-Screening Image Validation Gate

All uploaded images pass through a server-side pre-screening validation gate before reaching the DenseNet-121 model:

```
[ Uploaded Image ] 
        │
        ▼
[ Pillow Pre-check ] ── (Corrupt / Non-RGB / Out-of-bounds) ──> Reject (400 INVALID_IMAGE)
        │
        ▼
[ Gemini Vision API Gate ] 
        ├── Status: "non_fundus" ───────────────> Reject (400 NON_FUNDUS_IMAGE)
        ├── Status: "uncertain"  ───────────────> Reject (400 FUNDUS_CLASSIFICATION_UNCERTAIN)
        ├── Auth / Quota / Timeout Failure ─────> Fail Closed (429 / 500 / 504)
        └── Status: "valid_fundus" ─────────────> Proceed to DenseNet-121 Inference
                                                        │
                                                        ▼
                                          [ DR Severity Grade 0 - 4 ]
```

### Environment Configuration

Configure the following variables in your server environment (`.env`):

| Variable | Default | Description |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | *(Required)* | Google GenAI API key (keep server-side only; never expose to client) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Selected Gemini vision model |
| `ENABLE_GEMINI_VALIDATION` | `true` | Feature flag to enable/disable the validation gate |
| `GEMINI_TIMEOUT_SECONDS` | `10` | Bounded API call timeout in seconds |

## API Endpoints

### 1. Healthcheck
- **Method**: `GET /api/health`
- **Response**:
  ```json
  {
    "status": "healthy",
    "model_loaded": true,
    "model_version": "densenet121_ordinal_v1",
    "auth_enforced": false,
    "gemini_validation_enabled": true,
    "gemini_configured": true
  }
  ```

### 2. Diagnosis Inference
- **Method**: `POST /api/predict`
- **Headers**:
  - `Authorization: Bearer <SUPABASE_JWT>` (Optional, if configured)
- **Body**: Multipart form data with `image` file or JSON with base64 `image`.
- **Response (Accepted Fundus)**:
  ```json
  {
    "success": true,
    "grade": 2,
    "label": "Moderate non-proliferative diabetic retinopathy",
    "probabilities": [0.98, 0.92, 0.74, 0.12, 0.03],
    "model_version": "densenet121_ordinal_v1",
    "validation": {
      "status": "valid_fundus",
      "reason": "Retinal fundus image with optic disc and retinal vasculature.",
      "bypassed": false
    }
  }
  ```
- **Response (Rejected Non-Fundus)**:
  ```json
  {
    "success": false,
    "error": "The uploaded image does not appear to be a retinal fundus photograph.",
    "error_code": "NON_FUNDUS_IMAGE",
    "reason": "External face/eye photograph",
    "validation_status": "non_fundus"
  }
  ```

## Regulatory and Privacy Notice

1. **Non-Diagnostic Gate**: The Gemini validation module is strictly a technical input triage filter and is **NOT** a medical diagnostic device. It does not grade retinopathy or provide medical advice.
2. **Third-Party Data Transmission**: Retinal image bytes are transmitted securely to Google Gemini for modality validation. Production clinical deployments must obtain explicit patient consent and verify institutional HIPAA/GDPR data-handling compliance.
