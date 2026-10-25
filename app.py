import base64
import io
import os
from pathlib import Path

import jwt
import numpy as np
import tensorflow as tf
from flask import Flask, jsonify, render_template_string, request
from flask_cors import CORS
from PIL import Image, UnidentifiedImageError


PROJECT_DIR = Path(__file__).resolve().parent
MODEL_PATH = Path(
    os.environ.get("RETINA_MODEL_PATH", PROJECT_DIR / "retfound_model.keras")
)
IMAGE_SIZE = (224, 224)
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MODEL_VERSION = "densenet121_ordinal_v1"

GRADE_LABELS = {
    0: "No diabetic retinopathy",
    1: "Mild non-proliferative diabetic retinopathy",
    2: "Moderate non-proliferative diabetic retinopathy",
    3: "Severe non-proliferative diabetic retinopathy",
    4: "Proliferative diabetic retinopathy",
}

PAGE = """
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Diabetic Retinopathy Diagnostic Portal</title>
    <style>
      :root {
        --primary: #007A87;
        --navy: #0F1E36;
        --accent: #00B4D8;
        --bg: #F4F8FA;
        --surface: #FFFFFF;
        --text: #0B1A2C;
        --muted: #5A6E85;
      }
      body { font: 16px system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text);
             margin: 0; padding: 2.5rem 1rem; }
      main { max-width: 680px; margin: auto; padding: 2.5rem; background: var(--surface);
             border-radius: 16px; box-shadow: 0 10px 30px rgba(15, 30, 54, 0.08); border: 1px solid #E2E8F0; }
      .header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; }
      .badge { background: #E0F2FE; color: var(--primary); padding: 0.25rem 0.6rem; border-radius: 9999px;
               font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
      h1 { margin: 0; font-size: 1.6rem; color: var(--navy); }
      p { line-height: 1.6; color: var(--muted); }
      input, button { font: inherit; }
      .upload-box { border: 2px dashed #CBD5E1; padding: 2rem; border-radius: 12px; text-align: center;
                    margin: 1.5rem 0; cursor: pointer; transition: border-color 0.2s; }
      .upload-box:hover { border-color: var(--primary); }
      input[type="file"] { display: block; margin: 1rem auto 0; }
      button { border: 0; border-radius: 10px; padding: .85rem 1.5rem; width: 100%;
               background: var(--primary); color: white; cursor: pointer; font-weight: 600;
               font-size: 1rem; transition: background 0.2s; }
      button:hover { background: #006670; }
      button:disabled { opacity: .65; cursor: wait; }
      .result, .error, .notice { margin-top: 1.5rem; padding: 1.25rem; border-radius: 12px; }
      .result { background: #F0FDF4; border: 1px solid #BBF7D0; }
      .error { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
      .notice { background: #FFFBEB; font-size: .88rem; color: #92400E; border: 1px solid #FDE68A; }
      .grade { font-size: 1.25rem; font-weight: 700; color: #166534; }
      .api-link { margin-top: 1.5rem; text-align: center; font-size: 0.85rem; color: var(--muted); }
      .api-link a { color: var(--primary); font-weight: 600; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <div class="header">
        <span class="badge">Clinical AI Screening</span>
      </div>
      <h1>Diabetic Retinopathy Grading</h1>
      <p>Upload a retinal fundus photograph to receive an AI-assisted severity grading (Grades 0 to 4).</p>
      <form action="/predict" method="post" enctype="multipart/form-data"
            onsubmit="this.querySelector('button').disabled = true;
                      this.querySelector('button').textContent = 'Analyzing Retinal Image…';">
        <div class="upload-box">
          <label for="image">Select Retinal Fundus Photograph (JPEG or PNG)</label>
          <input id="image" name="image" type="file" accept="image/*" required>
        </div>
        <button type="submit">Run Diagnostic Inference</button>
      </form>
      {% if result %}
      <section class="result" aria-live="polite">
        <div class="grade">Grade {{ result.grade }}: {{ result.label }}</div>
      </section>
      {% endif %}
      {% if error %}
      <section class="error" role="alert">{{ error }}</section>
      {% endif %}
      <section class="notice">
        <strong>Clinical Screening Notice:</strong> Research prototype only. This prediction is an automated screening aid and not a medical diagnosis or substitute for an examination by a qualified ophthalmologist.
      </section>
      <div class="api-link">
        API ready: <code>POST /api/predict</code> &nbsp;|&nbsp; <code>GET /api/health</code>
      </div>
    </main>
  </body>
</html>
"""


def load_model(model_path=MODEL_PATH):
    if not model_path.is_file():
        raise FileNotFoundError(
            f"Model file not found: {model_path}. "
            "Set RETINA_MODEL_PATH to the trained .keras model."
        )
    return tf.keras.models.load_model(model_path, compile=False)


def predict_grade(model, image_bytes):
    try:
        with Image.open(io.BytesIO(image_bytes)) as source:
            image = source.convert("RGB").resize(
                IMAGE_SIZE,
                resample=Image.Resampling.LANCZOS,
            )
            batch = np.asarray(image, dtype=np.float32)[np.newaxis, ...]
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ValueError("The uploaded file is not a readable image.") from exc

    raw_preds = np.asarray(model(batch, training=False))
    if raw_preds.shape != (1, len(GRADE_LABELS)):
        raise RuntimeError(
            "The loaded model returned an unexpected output shape: "
            f"{raw_preds.shape}"
        )

    probabilities = [round(float(p), 4) for p in raw_preds[0]]
    grade = max(0, int(np.count_nonzero(raw_preds[0] >= 0.5) - 1))
    if grade not in GRADE_LABELS:
        raise RuntimeError(f"The model returned an invalid grade: {grade}")
    return grade, GRADE_LABELS[grade], probabilities


def verify_auth_token():
    secret = os.environ.get("SUPABASE_JWT_SECRET")
    if not secret:
        # Development mode: auth check bypassed if no secret configured
        return True, None

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return False, "Missing or invalid Authorization header"

    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return True, payload
    except jwt.PyJWTError as exc:
        return False, f"Invalid token: {exc}"


def create_app(model=None):
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES

    # Enable CORS for all /api/* routes
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    loaded_model = model if model is not None else load_model()

    # Browser Web UI
    @app.get("/")
    def index():
        return render_template_string(PAGE)

    @app.post("/predict")
    def predict_html():
        uploaded = request.files.get("image")
        if uploaded is None or not uploaded.filename:
            return render_template_string(
                PAGE, error="Choose an image file before submitting."
            ), 400

        try:
            grade, label, _probs = predict_grade(
                loaded_model, uploaded.read(MAX_UPLOAD_BYTES + 1)
            )
        except ValueError as exc:
            return render_template_string(PAGE, error=str(exc)), 400
        except Exception as exc:
            return render_template_string(PAGE, error=f"Internal error: {exc}"), 500

        return render_template_string(
            PAGE,
            result={"grade": grade, "label": label},
        )

    # API Endpoints
    @app.get("/api/health")
    def api_health():
        has_secret = bool(os.environ.get("SUPABASE_JWT_SECRET"))
        return jsonify(
            {
                "status": "healthy",
                "model_loaded": True,
                "model_version": MODEL_VERSION,
                "auth_enforced": has_secret,
            }
        ), 200

    @app.post("/api/predict")
    def api_predict():
        # Optional JWT authentication verification
        is_authenticated, auth_error = verify_auth_token()
        if not is_authenticated:
            return jsonify({"success": False, "error": auth_error}), 401

        image_bytes = None

        # Case 1: Multipart form upload
        if "image" in request.files:
            file = request.files["image"]
            if file.filename:
                image_bytes = file.read(MAX_UPLOAD_BYTES + 1)
        elif "file" in request.files:
            file = request.files["file"]
            if file.filename:
                image_bytes = file.read(MAX_UPLOAD_BYTES + 1)

        # Case 2: Base64 JSON payload
        elif request.is_json and request.json and "image" in request.json:
            raw_base64 = request.json["image"]
            if "," in raw_base64:
                raw_base64 = raw_base64.split(",", 1)[1]
            try:
                image_bytes = base64.b64decode(raw_base64)
            except Exception as exc:
                return jsonify(
                    {"success": False, "error": f"Invalid base64 encoding: {exc}"}
                ), 400

        if not image_bytes:
            return jsonify(
                {
                    "success": False,
                    "error": "No image provided. Send a multipart file ('image') or base64 JSON.",
                }
            ), 400

        if len(image_bytes) > MAX_UPLOAD_BYTES:
            return jsonify(
                {"success": False, "error": "Image exceeds 10 MB limit."}
            ), 413

        try:
            grade, label, probabilities = predict_grade(loaded_model, image_bytes)
        except ValueError as exc:
            return jsonify({"success": False, "error": str(exc)}), 400
        except Exception as exc:
            return jsonify(
                {"success": False, "error": f"Inference failed: {exc}"}
            ), 500

        return jsonify(
            {
                "success": True,
                "grade": grade,
                "label": label,
                "probabilities": probabilities,
                "model_version": MODEL_VERSION,
            }
        ), 200

    @app.errorhandler(413)
    def upload_too_large(_error):
        if request.path.startswith("/api/"):
            return jsonify(
                {"success": False, "error": "Maximum upload size is 10 MB."}
            ), 413
        return render_template_string(
            PAGE, error="The image is too large. Maximum upload size is 10 MB."
        ), 413

    return app


if __name__ == "__main__":
    application = create_app()
    application.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "5000")),
        debug=False,
    )
