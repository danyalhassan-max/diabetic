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
- **Architecture**: DenseNet-121 (Ordinal Classification)
- **Model File**: `retfound_model.keras`
- **Output Classes**:
  - `0`: No diabetic retinopathy
  - `1`: Mild non-proliferative diabetic retinopathy
  - `2`: Moderate non-proliferative diabetic retinopathy
  - `3`: Severe non-proliferative diabetic retinopathy
  - `4`: Proliferative diabetic retinopathy

## API Endpoints

### 1. Healthcheck
- **Method**: `GET /api/health`
- **Response**:
  ```json
  {
    "status": "healthy",
    "model_loaded": true,
    "model_version": "densenet121_ordinal_v1",
    "auth_enforced": false
  }
  ```

### 2. Diagnosis Inference
- **Method**: `POST /api/predict`
- **Headers**:
  - `Authorization: Bearer <SUPABASE_JWT>` (Optional, if configured)
- **Body**: Multipart form data with `image` file or JSON with `image_base64`.
- **Response**:
  ```json
  {
    "status": "success",
    "grade": 2,
    "label": "Moderate non-proliferative diabetic retinopathy",
    "probabilities": [0.98, 0.92, 0.74, 0.12, 0.03],
    "model_version": "densenet121_ordinal_v1"
  }
  ```
