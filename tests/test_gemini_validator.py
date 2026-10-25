"""
Tests for the Gemini Retinal Fundus Validation Module and API Gating.

Covers:
1. Valid fundus image -> Gemini accepts -> DR inference runs.
2. Selfie or unrelated image -> rejected -> DR inference is not called.
3. External-eye photograph -> rejected/handled according to classifier response.
4. Document or screenshot -> rejected when classified as non-fundus.
5. Uncertain Gemini response -> rejected from inference path.
6. Malformed JSON or missing response fields -> fails closed to uncertain.
7. Gemini timeout -> no DR inference (HTTP 504 GEMINI_TIMEOUT).
8. Gemini rate limit or auth error -> no DR inference (HTTP 429 / 500).
9. Missing API key -> clear configuration failure (HTTP 500 GEMINI_CONFIGURATION_ERROR).
10. Corrupted or oversized image -> rejected before Gemini is called (HTTP 400 INVALID_IMAGE).
11. Rejected image -> no completed scan record or fabricated grade.
12. Accepted image -> existing DenseNet-121 output and successful response remain compatible.
13. Feature flag toggle (ENABLE_GEMINI_VALIDATION=false bypass).
14. Opt-in live Gemini test (only executed if GEMINI_API_KEY is provided in environment).
"""

import base64
import io
import json
import os
import pytest
from PIL import Image

import app
import gemini_validator
from gemini_validator import (
    classify_fundus_image,
    validate_image_bytes,
    GeminiConfigurationError,
    GeminiRateLimitError,
    GeminiTimeoutError,
    GeminiUnavailableError,
    InvalidImageError,
    NonFundusImageError,
    UncertainFundusImageError,
    ValidationResult,
    ValidationStatus,
)


@pytest.fixture
def test_client():
    application = app.create_app()
    application.config["TESTING"] = True
    with application.test_client() as client:
        yield client


def make_test_image(width=300, height=300, format="JPEG", color=(180, 50, 40)):
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()


class MockGenAIResponse:
    def __init__(self, text: str):
        self.text = text


class MockGenAIClient:
    def __init__(self, response_text: str = "", side_effect: Exception = None):
        self.response_text = response_text
        self.side_effect = side_effect
        self.models = self

    def generate_content(self, *args, **kwargs):
        if self.side_effect:
            raise self.side_effect
        return MockGenAIResponse(self.response_text)


# =========================================================================
# Unit Tests: validate_image_bytes
# =========================================================================

def test_validate_image_bytes_valid_jpeg():
    raw = make_test_image(200, 200, "JPEG")
    sanitized, mime = validate_image_bytes(raw)
    assert mime == "image/jpeg"
    assert len(sanitized) > 0


def test_validate_image_bytes_valid_png():
    raw = make_test_image(250, 250, "PNG")
    sanitized, mime = validate_image_bytes(raw)
    assert mime == "image/jpeg"
    assert len(sanitized) > 0


def test_validate_image_bytes_empty():
    with pytest.raises(InvalidImageError, match="Uploaded file is empty"):
        validate_image_bytes(b"")


def test_validate_image_bytes_corrupted():
    with pytest.raises(InvalidImageError, match="Image could not be decoded"):
        validate_image_bytes(b"not an image binary payload")


def test_validate_image_bytes_too_small():
    raw = make_test_image(50, 50, "JPEG")
    with pytest.raises(InvalidImageError, match="too small"):
        validate_image_bytes(raw)


def test_validate_image_bytes_too_large_dimension():
    # Mock image size without allocating 9000x9000 buffer
    raw = make_test_image(120, 120, "JPEG")
    with pytest.raises(InvalidImageError):
        # We test with size > MAX_IMAGE_DIMENSION
        img = Image.new("RGB", (8001, 100), color=(100, 100, 100))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        validate_image_bytes(buf.getvalue())


def test_validate_image_bytes_unsupported_format():
    img = Image.new("RGB", (200, 200), color=(100, 100, 100))
    buf = io.BytesIO()
    img.save(buf, format="GIF")
    with pytest.raises(InvalidImageError, match="Unsupported image format: 'GIF'"):
        validate_image_bytes(buf.getvalue())


# =========================================================================
# Unit Tests: classify_fundus_image responses & exceptions
# =========================================================================

def test_classify_valid_fundus():
    mock_client = MockGenAIClient(
        response_text=json.dumps({
            "status": "valid_fundus",
            "reason": "Retinal fundus image with clear optic nerve disc and vessels."
        })
    )
    res = classify_fundus_image(
        make_test_image(),
        client=mock_client
    )
    assert res.status == ValidationStatus.VALID_FUNDUS
    assert res.is_valid_fundus is True
    assert "optic nerve" in res.reason


def test_classify_non_fundus():
    mock_client = MockGenAIClient(
        response_text=json.dumps({
            "status": "non_fundus",
            "reason": "Photograph of an external eye and surrounding eyelids."
        })
    )
    res = classify_fundus_image(
        make_test_image(),
        client=mock_client
    )
    assert res.status == ValidationStatus.NON_FUNDUS
    assert res.is_valid_fundus is False
    assert "external eye" in res.reason


def test_classify_uncertain():
    mock_client = MockGenAIClient(
        response_text=json.dumps({
            "status": "uncertain",
            "reason": "Image is severely out of focus and darkness obscures retinal landmarks."
        })
    )
    res = classify_fundus_image(
        make_test_image(),
        client=mock_client
    )
    assert res.status == ValidationStatus.UNCERTAIN
    assert res.is_valid_fundus is False


def test_classify_malformed_json_fails_closed():
    mock_client = MockGenAIClient(response_text="Not valid JSON response text {{{")
    res = classify_fundus_image(
        make_test_image(),
        client=mock_client
    )
    assert res.status == ValidationStatus.UNCERTAIN
    assert "could not be safely validated" in res.reason


def test_classify_empty_response_fails_closed():
    mock_client = MockGenAIClient(response_text="")
    res = classify_fundus_image(
        make_test_image(),
        client=mock_client
    )
    assert res.status == ValidationStatus.UNCERTAIN
    assert "empty response" in res.reason


def test_classify_missing_api_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("ENABLE_GEMINI_VALIDATION", "true")
    with pytest.raises(GeminiConfigurationError, match="GEMINI_API_KEY is not configured"):
        classify_fundus_image(make_test_image(), client=None)


def test_classify_disabled_bypasses(monkeypatch):
    monkeypatch.setenv("ENABLE_GEMINI_VALIDATION", "false")
    res = classify_fundus_image(make_test_image(), client=None)
    assert res.status == ValidationStatus.VALID_FUNDUS
    assert res.bypassed is True


# =========================================================================
# Integration Tests: /api/predict end-to-end gating
# =========================================================================

def test_scenario_1_valid_fundus_accepted_and_dr_inferred(test_client, monkeypatch):
    """1. Valid fundus image -> Gemini accepts -> existing DR inference runs."""
    monkeypatch.setattr(
        "app.classify_fundus_image",
        lambda *args, **kwargs: ValidationResult(
            status=ValidationStatus.VALID_FUNDUS,
            reason="Retina fundus with macula and vascular arcade."
        )
    )

    img_bytes = make_test_image(224, 224)
    data = {"image": (io.BytesIO(img_bytes), "fundus.jpg")}
    resp = test_client.post("/api/predict", data=data, content_type="multipart/form-data")

    assert resp.status_code == 200
    res = resp.get_json()
    assert res["success"] is True
    assert 0 <= res["grade"] <= 4
    assert res["label"] in app.GRADE_LABELS.values()
    assert len(res["probabilities"]) == 5
    assert res["validation"]["status"] == "valid_fundus"


def test_scenario_2_selfie_rejected_no_dr_inference(test_client, monkeypatch):
    """2. Selfie or unrelated image -> rejected -> DR inference is NOT called."""
    dense_net_called = []
    monkeypatch.setattr(
        "app.predict_grade",
        lambda *args, **kwargs: dense_net_called.append(True)
    )
    monkeypatch.setattr(
        "app.classify_fundus_image",
        lambda *args, **kwargs: ValidationResult(
            status=ValidationStatus.NON_FUNDUS,
            reason="Image appears to be a front-facing selfie portrait."
        )
    )

    img_bytes = make_test_image()
    b64_str = "data:image/jpeg;base64," + base64.b64encode(img_bytes).decode()
    resp = test_client.post("/api/predict", json={"image": b64_str})

    assert resp.status_code == 400
    res = resp.get_json()
    assert res["success"] is False
    assert res["error_code"] == "NON_FUNDUS_IMAGE"
    assert "selfie" in res["reason"]
    assert "grade" not in res
    assert len(dense_net_called) == 0  # CRITICAL: DenseNet was not called


def test_scenario_3_external_eye_rejected(test_client, monkeypatch):
    """3. External-eye photograph -> rejected when classified as non-fundus."""
    dense_net_called = []
    monkeypatch.setattr(
        "app.predict_grade",
        lambda *args, **kwargs: dense_net_called.append(True)
    )
    monkeypatch.setattr(
        "app.classify_fundus_image",
        lambda *args, **kwargs: ValidationResult(
            status=ValidationStatus.NON_FUNDUS,
            reason="External macro photograph of iris and eyelashes, not internal retinal fundus."
        )
    )

    img_bytes = make_test_image()
    resp = test_client.post(
        "/api/predict",
        data={"image": (io.BytesIO(img_bytes), "eye.jpg")},
        content_type="multipart/form-data"
    )
    assert resp.status_code == 400
    res = resp.get_json()
    assert res["error_code"] == "NON_FUNDUS_IMAGE"
    assert len(dense_net_called) == 0


def test_scenario_4_document_screenshot_rejected(test_client, monkeypatch):
    """4. Document or screenshot -> rejected when classified as non-fundus."""
    dense_net_called = []
    monkeypatch.setattr(
        "app.predict_grade",
        lambda *args, **kwargs: dense_net_called.append(True)
    )
    monkeypatch.setattr(
        "app.classify_fundus_image",
        lambda *args, **kwargs: ValidationResult(
            status=ValidationStatus.NON_FUNDUS,
            reason="Image is a document with text and diagrams."
        )
    )

    img_bytes = make_test_image()
    resp = test_client.post("/api/predict", json={"image": base64.b64encode(img_bytes).decode()})
    assert resp.status_code == 400
    res = resp.get_json()
    assert res["error_code"] == "NON_FUNDUS_IMAGE"
    assert len(dense_net_called) == 0


def test_scenario_5_uncertain_gemini_response_rejected(test_client, monkeypatch):
    """5. Uncertain Gemini response -> rejected from inference path."""
    dense_net_called = []
    monkeypatch.setattr(
        "app.predict_grade",
        lambda *args, **kwargs: dense_net_called.append(True)
    )
    monkeypatch.setattr(
        "app.classify_fundus_image",
        lambda *args, **kwargs: ValidationResult(
            status=ValidationStatus.UNCERTAIN,
            reason="Severe blur and glare prevent confirmation of retinal features."
        )
    )

    img_bytes = make_test_image()
    resp = test_client.post(
        "/api/predict",
        data={"image": (io.BytesIO(img_bytes), "blurry.jpg")},
        content_type="multipart/form-data"
    )
    assert resp.status_code == 400
    res = resp.get_json()
    assert res["error_code"] == "FUNDUS_CLASSIFICATION_UNCERTAIN"
    assert "upload a clear fundus" in res["error"]
    assert len(dense_net_called) == 0


def test_scenario_6_malformed_json_fails_closed(test_client, monkeypatch):
    """6. Malformed JSON or missing response fields -> fails closed to uncertain."""
    dense_net_called = []
    monkeypatch.setattr(
        "app.predict_grade",
        lambda *args, **kwargs: dense_net_called.append(True)
    )
    # Simulate Gemini returning unparseable content, which gemini_validator turns into UNCERTAIN
    mock_client = MockGenAIClient(response_text="INVALID GARBAGE JSON")
    monkeypatch.setattr(
        "gemini_validator.get_gemini_api_key",
        lambda: "test-fake-key"
    )

    img_bytes = make_test_image()
    sanitized, mime = validate_image_bytes(img_bytes)
    res = classify_fundus_image(sanitized, mime, client=mock_client)
    assert res.status == ValidationStatus.UNCERTAIN

    # And in the endpoint:
    monkeypatch.setattr(
        "app.classify_fundus_image",
        lambda *args, **kwargs: res
    )
    resp = test_client.post(
        "/api/predict",
        data={"image": (io.BytesIO(img_bytes), "test.jpg")},
        content_type="multipart/form-data"
    )
    assert resp.status_code == 400
    assert resp.get_json()["error_code"] == "FUNDUS_CLASSIFICATION_UNCERTAIN"
    assert len(dense_net_called) == 0


def test_scenario_7_gemini_timeout(test_client, monkeypatch):
    """7. Gemini timeout -> no DR inference, returns HTTP 504."""
    dense_net_called = []
    monkeypatch.setattr(
        "app.predict_grade",
        lambda *args, **kwargs: dense_net_called.append(True)
    )
    def raise_timeout(*args, **kwargs):
        raise GeminiTimeoutError("Request timed out after 10s.")
    monkeypatch.setattr("app.classify_fundus_image", raise_timeout)

    img_bytes = make_test_image()
    resp = test_client.post(
        "/api/predict",
        data={"image": (io.BytesIO(img_bytes), "test.jpg")},
        content_type="multipart/form-data"
    )
    assert resp.status_code == 504
    res = resp.get_json()
    assert res["error_code"] == "GEMINI_TIMEOUT"
    assert len(dense_net_called) == 0


def test_scenario_8_gemini_rate_limit(test_client, monkeypatch):
    """8. Gemini rate limit -> no DR inference, returns HTTP 429."""
    dense_net_called = []
    monkeypatch.setattr(
        "app.predict_grade",
        lambda *args, **kwargs: dense_net_called.append(True)
    )
    def raise_rate_limit(*args, **kwargs):
        raise GeminiRateLimitError("Quota exceeded.")
    monkeypatch.setattr("app.classify_fundus_image", raise_rate_limit)

    img_bytes = make_test_image()
    resp = test_client.post(
        "/api/predict",
        data={"image": (io.BytesIO(img_bytes), "test.jpg")},
        content_type="multipart/form-data"
    )
    assert resp.status_code == 429
    res = resp.get_json()
    assert res["error_code"] == "GEMINI_RATE_LIMITED"
    assert len(dense_net_called) == 0


def test_scenario_9_missing_api_key_configuration_error(test_client, monkeypatch):
    """9. Missing API key -> clear configuration failure (HTTP 500)."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("ENABLE_GEMINI_VALIDATION", "true")

    img_bytes = make_test_image()
    resp = test_client.post(
        "/api/predict",
        data={"image": (io.BytesIO(img_bytes), "test.jpg")},
        content_type="multipart/form-data"
    )
    assert resp.status_code == 500
    res = resp.get_json()
    assert res["error_code"] == "GEMINI_CONFIGURATION_ERROR"


def test_scenario_10_corrupted_or_undersized_image_rejected_before_gemini(test_client, monkeypatch):
    """10. Corrupted or undersized image -> rejected before Gemini is called."""
    gemini_called = []
    monkeypatch.setattr(
        "app.classify_fundus_image",
        lambda *args, **kwargs: gemini_called.append(True)
    )

    # 10a: Corrupted bytes
    resp = test_client.post(
        "/api/predict",
        data={"image": (io.BytesIO(b"garbage not an image"), "bad.jpg")},
        content_type="multipart/form-data"
    )
    assert resp.status_code == 400
    res = resp.get_json()
    assert res["error_code"] == "INVALID_IMAGE"
    assert len(gemini_called) == 0

    # 10b: Dimension under 100x100
    tiny_img = make_test_image(50, 50)
    resp = test_client.post(
        "/api/predict",
        data={"image": (io.BytesIO(tiny_img), "tiny.jpg")},
        content_type="multipart/form-data"
    )
    assert resp.status_code == 400
    res = resp.get_json()
    assert res["error_code"] == "INVALID_IMAGE"
    assert "too small" in res["error"]
    assert len(gemini_called) == 0


def test_scenario_11_rejected_image_no_fabricated_grade(test_client, monkeypatch):
    """11. Rejected image -> no completed scan record or fabricated grade."""
    monkeypatch.setattr(
        "app.classify_fundus_image",
        lambda *args, **kwargs: ValidationResult(
            status=ValidationStatus.NON_FUNDUS,
            reason="Image is an X-ray of the chest."
        )
    )
    img_bytes = make_test_image()
    resp = test_client.post(
        "/api/predict",
        data={"image": (io.BytesIO(img_bytes), "xray.jpg")},
        content_type="multipart/form-data"
    )
    assert resp.status_code == 400
    res = resp.get_json()
    assert "grade" not in res
    assert "label" not in res
    assert "probabilities" not in res
    assert res["success"] is False


def test_scenario_12_accepted_image_response_schema_compatibility(test_client, monkeypatch):
    """12. Accepted image -> existing DenseNet-121 output and successful response remain compatible."""
    monkeypatch.setattr(
        "app.classify_fundus_image",
        lambda *args, **kwargs: ValidationResult(
            status=ValidationStatus.VALID_FUNDUS,
            reason="Retinal photograph showing optic cup, macula, and vascular arcades."
        )
    )
    img_bytes = make_test_image(224, 224)
    resp = test_client.post(
        "/api/predict",
        data={"image": (io.BytesIO(img_bytes), "fundus.jpg")},
        content_type="multipart/form-data"
    )
    assert resp.status_code == 200
    res = resp.get_json()
    assert res["success"] is True
    assert isinstance(res["grade"], int)
    assert 0 <= res["grade"] <= 4
    assert isinstance(res["label"], str)
    assert isinstance(res["probabilities"], list)
    assert len(res["probabilities"]) == 5
    assert res["model_version"] == "densenet121_ordinal_v1"
    assert "validation" in res
    assert res["validation"]["status"] == "valid_fundus"


def test_health_endpoint_reports_gemini_status(test_client, monkeypatch):
    """Health endpoint reports model loaded, auth, and Gemini validation config status."""
    monkeypatch.setenv("ENABLE_GEMINI_VALIDATION", "true")
    monkeypatch.setenv("GEMINI_API_KEY", "test_key_abc")

    resp = test_client.get("/api/health")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "healthy"
    assert data["gemini_validation_enabled"] is True
    assert data["gemini_configured"] is True


def test_web_html_predict_valid_and_non_fundus(test_client, monkeypatch):
    """Web HTML interface respects validation gate."""
    # Non-fundus rejection
    monkeypatch.setattr(
        "app.classify_fundus_image",
        lambda *args, **kwargs: ValidationResult(
            status=ValidationStatus.NON_FUNDUS,
            reason="Cat photograph"
        )
    )
    resp = test_client.post(
        "/predict",
        data={"image": (io.BytesIO(make_test_image()), "cat.jpg")},
        content_type="multipart/form-data"
    )
    assert resp.status_code == 400
    assert b"Validation Rejected" in resp.data

    # Valid fundus acceptance
    monkeypatch.setattr(
        "app.classify_fundus_image",
        lambda *args, **kwargs: ValidationResult(
            status=ValidationStatus.VALID_FUNDUS,
            reason="Clear retinal fundus"
        )
    )
    resp = test_client.post(
        "/predict",
        data={"image": (io.BytesIO(make_test_image(224, 224)), "retina.jpg")},
        content_type="multipart/form-data"
    )
    assert resp.status_code == 200
    assert b"Grade" in resp.data


# =========================================================================
# Opt-in Live Test with Real API Key (skipped if no key in environment)
# =========================================================================

@pytest.mark.skipif(
    not os.environ.get("GEMINI_API_KEY"),
    reason="Live Gemini API test skipped: GEMINI_API_KEY not configured in environment."
)
def test_live_gemini_integration():
    """Live test executed only when a real GEMINI_API_KEY is supplied."""
    sanitized, mime = validate_image_bytes(make_test_image(300, 300))
    res = classify_fundus_image(sanitized, mime)
    assert res.status in (
        ValidationStatus.VALID_FUNDUS,
        ValidationStatus.NON_FUNDUS,
        ValidationStatus.UNCERTAIN
    )
    assert len(res.reason) > 0
