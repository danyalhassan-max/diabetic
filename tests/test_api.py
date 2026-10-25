import base64
import io
import pytest
from PIL import Image
import app


@pytest.fixture(scope="module")
def client():
    application = app.create_app()
    application.config["TESTING"] = True
    with application.test_client() as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def mock_gemini_valid(monkeypatch):
    from gemini_validator import ValidationResult, ValidationStatus
    monkeypatch.setattr(
        "app.classify_fundus_image",
        lambda *args, **kwargs: ValidationResult(
            status=ValidationStatus.VALID_FUNDUS,
            reason="Mocked valid fundus for baseline api tests."
        )
    )


def create_test_image_bytes():
    img = Image.new("RGB", (224, 224), color=(160, 45, 35))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_html_index(client):
    response = client.get("/")
    assert response.status_code == 200
    assert b"Diabetic Retinopathy" in response.data
    assert b"Clinical AI Screening" in response.data


def test_api_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True
    assert data["model_version"] == "densenet121_ordinal_v1"


def test_api_predict_multipart(client):
    img_bytes = create_test_image_bytes()
    data = {
        "image": (io.BytesIO(img_bytes), "test_retina.jpg")
    }
    response = client.post(
        "/api/predict",
        data=data,
        content_type="multipart/form-data"
    )
    assert response.status_code == 200
    res = response.get_json()
    assert res["success"] is True
    assert 0 <= res["grade"] <= 4
    assert res["label"] in app.GRADE_LABELS.values()
    assert len(res["probabilities"]) == 5


def test_api_predict_base64(client):
    img_bytes = create_test_image_bytes()
    b64_str = "data:image/jpeg;base64," + base64.b64encode(img_bytes).decode("utf-8")
    response = client.post(
        "/api/predict",
        json={"image": b64_str}
    )
    assert response.status_code == 200
    res = response.get_json()
    assert res["success"] is True
    assert 0 <= res["grade"] <= 4
    assert len(res["probabilities"]) == 5


def test_api_predict_no_image(client):
    response = client.post(
        "/api/predict",
        json={"other": "data"}
    )
    assert response.status_code == 400
    res = response.get_json()
    assert res["success"] is False
    assert "No image provided" in res["error"]


def test_cors_headers(client):
    response = client.options(
        "/api/predict",
        headers={"Origin": "http://localhost:8081"}
    )
    assert response.headers.get("Access-Control-Allow-Origin") in ["*", "http://localhost:8081"]
