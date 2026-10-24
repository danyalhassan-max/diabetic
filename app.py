import io
import os
from pathlib import Path

import numpy as np
import tensorflow as tf
from flask import Flask, render_template_string, request
from PIL import Image, UnidentifiedImageError


PROJECT_DIR = Path(__file__).resolve().parent
MODEL_PATH = Path(
    os.environ.get("RETINA_MODEL_PATH", PROJECT_DIR / "retfound_model.keras")
)
IMAGE_SIZE = (224, 224)
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

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
    <title>Diabetic Retinopathy Grading</title>
    <style>
      body { font: 16px system-ui, sans-serif; background: #f2f6fa; color: #172b4d;
             margin: 0; padding: 3rem 1rem; }
      main { max-width: 620px; margin: auto; padding: 2rem; background: white;
             border-radius: 16px; box-shadow: 0 8px 28px #19334d18; }
      h1 { margin-top: 0; }
      p { line-height: 1.55; }
      input, button { font: inherit; }
      input { display: block; width: 100%; margin: 1.25rem 0; }
      button { border: 0; border-radius: 8px; padding: .75rem 1.2rem;
               background: #145da0; color: white; cursor: pointer; }
      button:disabled { opacity: .65; cursor: wait; }
      .result, .error, .notice { margin-top: 1.5rem; padding: 1rem;
                                  border-radius: 8px; }
      .result { background: #e9f7ef; }
      .error { background: #fff0f0; color: #8d2020; }
      .notice { background: #fff8e5; font-size: .92rem; }
      .grade { font-size: 1.2rem; font-weight: 700; }
    </style>
  </head>
  <body>
    <main>
      <h1>Diabetic Retinopathy Grading</h1>
      <p>Upload a retinal fundus image to receive a model-generated grade.</p>
      <form action="/predict" method="post" enctype="multipart/form-data"
            onsubmit="this.querySelector('button').disabled = true;
                      this.querySelector('button').textContent = 'Analyzing…';">
        <label for="image">Retinal image (JPEG, PNG, or another supported image format)</label>
        <input id="image" name="image" type="file" accept="image/*" required>
        <button type="submit">Analyze image</button>
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
        Research prototype only. This prediction is not a medical diagnosis or a
        substitute for examination by a qualified eye-care professional.
      </section>
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

    probabilities = np.asarray(model(batch, training=False))
    if probabilities.shape != (1, len(GRADE_LABELS)):
        raise RuntimeError(
            "The loaded model returned an unexpected output shape: "
            f"{probabilities.shape}"
        )

    grade = int(np.count_nonzero(probabilities[0] >= 0.5) - 1)
    if grade not in GRADE_LABELS:
        raise RuntimeError(f"The model returned an invalid grade: {grade}")
    return grade


def create_app(model=None):
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES
    loaded_model = model if model is not None else load_model()

    @app.get("/")
    def index():
        return render_template_string(PAGE)

    @app.post("/predict")
    def predict():
        uploaded = request.files.get("image")
        if uploaded is None or not uploaded.filename:
            return render_template_string(
                PAGE, error="Choose an image file before submitting."
            ), 400

        try:
            grade = predict_grade(loaded_model, uploaded.read(MAX_UPLOAD_BYTES + 1))
        except ValueError as exc:
            return render_template_string(PAGE, error=str(exc)), 400

        return render_template_string(
            PAGE,
            result={"grade": grade, "label": GRADE_LABELS[grade]},
        )

    @app.errorhandler(413)
    def upload_too_large(_error):
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
