import io
import pytest
import numpy as np
from PIL import Image
import app


@pytest.fixture(scope="module")
def model():
    return app.load_model()


def test_model_loaded(model):
    assert model is not None
    assert len(model.layers) > 0


def test_predict_grade_dummy_image(model):
    # Create synthetic RGB image
    img = Image.new("RGB", (256, 256), color=(180, 50, 40))
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG")
    image_bytes = buffer.getvalue()

    grade, label, probabilities = app.predict_grade(model, image_bytes)

    assert isinstance(grade, int)
    assert 0 <= grade <= 4
    assert label in app.GRADE_LABELS.values()
    assert isinstance(probabilities, list)
    assert len(probabilities) == 5
    for p in probabilities:
        assert 0.0 <= p <= 1.0


def test_predict_invalid_image(model):
    with pytest.raises(ValueError, match="not a readable image"):
        app.predict_grade(model, b"not_an_image_binary_data")


def test_all_zeros_threshold_edge_case(monkeypatch, model):
    # Mock model output to return all zeroes [0.0, 0.0, 0.0, 0.0, 0.0]
    # to verify that grade defaults safely to 0 instead of -1
    class MockModelZero:
        def __call__(self, batch, training=False):
            return np.zeros((1, 5), dtype=np.float32)

    img = Image.new("RGB", (224, 224), color=(0, 0, 0))
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")

    grade, label, probabilities = app.predict_grade(MockModelZero(), buffer.getvalue())
    assert grade == 0
    assert label == "No diabetic retinopathy"
    assert probabilities == [0.0, 0.0, 0.0, 0.0, 0.0]
