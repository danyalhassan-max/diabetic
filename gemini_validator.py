"""
Gemini Retinal Fundus Image Validation Module.

A narrowly scoped pre-screening triage gate that verifies whether an uploaded
image appears to be a retinal fundus photograph suitable for diabetic retinopathy
grading before invoking the DenseNet-121 inference model.

IMPORTANT: This module does NOT diagnose diabetic retinopathy, evaluate disease
severity, or provide clinical medical advice.
"""

from __future__ import annotations

import io
import logging
import os
from enum import Enum
from typing import Optional, Tuple

import httpx
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field

# Prevent PIL decompression bombs on large image files
Image.MAX_IMAGE_PIXELS = 64_000_000

logger = logging.getLogger(__name__)

# Image validation limits
MIN_IMAGE_DIMENSION = 100
MAX_IMAGE_DIMENSION = 8000
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB
SUPPORTED_FORMATS = {"JPEG", "JPG", "PNG", "WEBP"}


class ValidationStatus(str, Enum):
    VALID_FUNDUS = "valid_fundus"
    NON_FUNDUS = "non_fundus"
    UNCERTAIN = "uncertain"


class GeminiFundusResponse(BaseModel):
    status: ValidationStatus = Field(
        description=(
            "Classification status: 'valid_fundus' if the image is a retinal fundus "
            "photograph showing retinal anatomy (optic disc, macula, or retinal vasculature); "
            "'non_fundus' if the image is anything else (such as a selfie, portrait, external "
            "eye photo, pet, document, chest X-ray, landscape, screenshot, or unrelated object); "
            "'uncertain' if image quality is severely degraded, completely corrupted, ambiguous, "
            "or cannot be safely determined."
        )
    )
    reason: str = Field(
        description=(
            "A brief, factual visual description justifying the determination (e.g. 'Retinal "
            "fundus photograph with visible optic disc and retinal blood vessels' or 'Photograph "
            "of an external eye and eyelid'). Do NOT provide any clinical diagnosis or DR grade."
        )
    )


class ValidationResult:
    def __init__(self, status: ValidationStatus, reason: str, bypassed: bool = False):
        self.status = status
        self.reason = reason
        self.bypassed = bypassed

    @property
    def is_valid_fundus(self) -> bool:
        return self.status == ValidationStatus.VALID_FUNDUS

    def to_dict(self) -> dict:
        return {
            "status": self.status.value,
            "reason": self.reason,
            "bypassed": self.bypassed,
        }


# Custom Exception Hierarchy
class FundusValidationError(Exception):
    """Base exception for fundus validation pipeline."""
    def __init__(self, message: str, error_code: str):
        super().__init__(message)
        self.message = message
        self.error_code = error_code


class InvalidImageError(FundusValidationError):
    """Uploaded bytes do not form a valid, supported image."""
    def __init__(self, message: str = "Invalid or unsupported image file."):
        super().__init__(message, "INVALID_IMAGE")


class NonFundusImageError(FundusValidationError):
    """Image was verified as not being a retinal fundus photograph."""
    def __init__(self, reason: str = "Image does not appear to be a retinal fundus photograph."):
        super().__init__(reason, "NON_FUNDUS_IMAGE")
        self.reason = reason


class UncertainFundusImageError(FundusValidationError):
    """Classifier could not determine with certainty if image is a valid fundus photograph."""
    def __init__(self, reason: str = "Fundus classification is uncertain."):
        super().__init__(reason, "FUNDUS_CLASSIFICATION_UNCERTAIN")
        self.reason = reason


class GeminiConfigurationError(FundusValidationError):
    """Server-side Gemini API key or configuration is missing or invalid."""
    def __init__(self, message: str = "Gemini API configuration is missing or invalid."):
        super().__init__(message, "GEMINI_CONFIGURATION_ERROR")


class GeminiRateLimitError(FundusValidationError):
    """Gemini API rate limit or quota exceeded."""
    def __init__(self, message: str = "Gemini API rate limit exceeded."):
        super().__init__(message, "GEMINI_RATE_LIMITED")


class GeminiTimeoutError(FundusValidationError):
    """Gemini API request timed out."""
    def __init__(self, message: str = "Gemini API request timed out."):
        super().__init__(message, "GEMINI_TIMEOUT")


class GeminiUnavailableError(FundusValidationError):
    """Gemini API is unavailable due to network, service, or server errors."""
    def __init__(self, message: str = "Gemini validation service is currently unavailable."):
        super().__init__(message, "GEMINI_VALIDATION_UNAVAILABLE")


def validate_image_bytes(image_bytes: bytes) -> Tuple[bytes, str]:
    """
    Validates raw image bytes and normalizes orientation and format.

    - Rejects empty, oversize (>10MB), corrupted, or unreadable images.
    - Rejects images with dimensions < 100x100 or > 8000x8000.
    - Rejects unsupported image formats (only JPEG, PNG, WEBP allowed).
    - Normalizes EXIF orientation and converts to standard RGB JPEG representation.

    Returns:
        (sanitized_jpeg_bytes, mime_type)
    """
    if not image_bytes:
        raise InvalidImageError("Uploaded file is empty.")

    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise InvalidImageError(f"Image exceeds maximum allowable size of {MAX_IMAGE_BYTES // (1024 * 1024)} MB.")

    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            fmt = (img.format or "").upper()
            if fmt not in SUPPORTED_FORMATS:
                raise InvalidImageError(
                    f"Unsupported image format: '{fmt or 'unknown'}'. "
                    f"Supported formats: {', '.join(sorted(SUPPORTED_FORMATS))}."
                )

            width, height = img.size
            if width < MIN_IMAGE_DIMENSION or height < MIN_IMAGE_DIMENSION:
                raise InvalidImageError(
                    f"Image dimensions ({width}x{height}) are too small for retinal screening. "
                    f"Minimum size is {MIN_IMAGE_DIMENSION}x{MIN_IMAGE_DIMENSION} pixels."
                )

            if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
                raise InvalidImageError(
                    f"Image dimensions ({width}x{height}) exceed maximum allowed size "
                    f"of {MAX_IMAGE_DIMENSION}x{MAX_IMAGE_DIMENSION} pixels."
                )

            # Apply EXIF orientation transposition if present
            try:
                transposed = ImageOps.exif_transpose(img)
                work_img = transposed if transposed is not None else img
            except Exception:
                work_img = img

            # Convert to standard RGB
            rgb_img = work_img.convert("RGB")

            # Encode as sanitized JPEG
            buf = io.BytesIO()
            rgb_img.save(buf, format="JPEG", quality=95)
            sanitized_bytes = buf.getvalue()

            return sanitized_bytes, "image/jpeg"

    except (UnidentifiedImageError, OSError, ValueError) as exc:
        if isinstance(exc, InvalidImageError):
            raise
        raise InvalidImageError(f"Image could not be decoded or is corrupted: {exc}") from exc


CLASSIFICATION_PROMPT = """You are a technical image triage classifier for a diabetic retinopathy screening application.
Your single purpose is to determine whether the provided photograph appears to be a retinal fundus photograph suitable for an automated diabetic retinopathy screening pipeline.

Strict Classification Criteria:
- valid_fundus: The image is an internal retinal fundus photograph depicting retinal anatomy (e.g., optic disc, retinal blood vessels, macula, or posterior pole).
- non_fundus: The image is NOT an internal retinal fundus photograph. Examples include: external face or eye/eyelid photographs, selfies, pets, documents, text charts, general medical images (X-rays/CT scans), outdoor scenes, screenshots, or any non-retinal objects.
- uncertain: The image is too severely degraded, blurred, dark, unidentifiable, or ambiguous to safely verify as a retinal fundus photograph.

Safety Rules:
1. Do NOT evaluate disease severity or diagnose diabetic retinopathy.
2. Do NOT provide any clinical recommendations or medical advice.
3. If the image is not clearly an internal retinal fundus photograph, strictly classify it as non_fundus or uncertain.
"""


def is_validation_enabled() -> bool:
    val = os.environ.get("ENABLE_GEMINI_VALIDATION", "true").strip().lower()
    return val in ("1", "true", "yes", "on")


def get_gemini_api_key() -> Optional[str]:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    return key if key else None


def get_gemini_model_name() -> str:
    return os.environ.get("GEMINI_MODEL", "gemini-2.5-flash").strip()


def get_gemini_timeout() -> float:
    try:
        return float(os.environ.get("GEMINI_TIMEOUT_SECONDS", "10.0"))
    except ValueError:
        return 10.0


def classify_fundus_image(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    client: Optional[object] = None,
) -> ValidationResult:
    """
    Classifies an image as valid_fundus, non_fundus, or uncertain using Gemini.

    Parameters:
        image_bytes: Pre-validated image byte buffer.
        mime_type: Image MIME type (default 'image/jpeg').
        client: Optional genai.Client instance (useful for dependency injection and tests).

    Returns:
        ValidationResult object with .status and .reason.

    Raises:
        GeminiConfigurationError: If validation is enabled but API key is missing.
        GeminiRateLimitError: On HTTP 429 quota/rate limit.
        GeminiTimeoutError: On request timeout.
        GeminiUnavailableError: On connection/network/service errors.
    """
    if not is_validation_enabled():
        logger.info("Gemini image validation is disabled via ENABLE_GEMINI_VALIDATION=false; bypassing gate.")
        return ValidationResult(
            status=ValidationStatus.VALID_FUNDUS,
            reason="Validation gate bypassed by server configuration.",
            bypassed=True,
        )

    model_name = get_gemini_model_name()
    timeout_sec = get_gemini_timeout()

    if client is None:
        api_key = get_gemini_api_key()
        if not api_key:
            logger.error("GEMINI_API_KEY environment variable is not configured.")
            raise GeminiConfigurationError("GEMINI_API_KEY is not configured on the server.")

        try:
            from google import genai
            from google.genai import types
            client = genai.Client(
                api_key=api_key,
                http_options=types.HttpOptions(timeout=timeout_sec),
            )
        except Exception as exc:
            logger.error(f"Failed to initialize Gemini client: {exc}")
            raise GeminiConfigurationError(f"Failed to initialize Gemini client: {exc}") from exc
    else:
        from google.genai import types

    part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=GeminiFundusResponse,
        temperature=0.0,
    )

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=[part, CLASSIFICATION_PROMPT],
            config=config,
        )
    except Exception as exc:
        return _handle_gemini_api_exception(exc)

    return _parse_gemini_response(response)


def _handle_gemini_api_exception(exc: Exception) -> ValidationResult:
    from google.genai import errors

    # Check for Timeout
    if isinstance(exc, (httpx.TimeoutException, TimeoutError)):
        logger.warning(f"Gemini API request timed out: {exc}")
        raise GeminiTimeoutError("Gemini API request timed out.") from exc

    # Check for Google GenAI API errors
    if isinstance(exc, errors.APIError):
        code = getattr(exc, "code", None)
        message = str(exc)
        if code == 429 or "resource_exhausted" in message.lower() or "quota" in message.lower():
            logger.warning(f"Gemini API rate limited: {exc}")
            raise GeminiRateLimitError("Gemini API rate limit exceeded.") from exc
        if code in (401, 403) or "unauthenticated" in message.lower() or "api key not valid" in message.lower():
            logger.error(f"Gemini authentication failure: {exc}")
            raise GeminiConfigurationError("Gemini API authentication failed.") from exc
        if code == 408 or "timeout" in message.lower() or "deadline" in message.lower():
            logger.warning(f"Gemini API deadline exceeded: {exc}")
            raise GeminiTimeoutError("Gemini API request timed out.") from exc
        logger.error(f"Gemini API error ({code}): {exc}")
        raise GeminiUnavailableError("Gemini validation service error.") from exc

    # Catch network/connection errors
    if isinstance(exc, (httpx.NetworkError, httpx.ConnectError, ConnectionError)):
        logger.error(f"Gemini connection failure: {exc}")
        raise GeminiUnavailableError("Could not connect to Gemini validation service.") from exc

    # Any other exception
    logger.error(f"Unexpected error during Gemini validation: {exc}")
    raise GeminiUnavailableError(f"Gemini validation failed: {exc}") from exc


def _parse_gemini_response(response: object) -> ValidationResult:
    """
    Parses and strictly validates the Gemini structured response.
    Fails closed to 'uncertain' if response is empty, malformed, or unparseable.
    """
    raw_text = getattr(response, "text", None)
    if not raw_text or not raw_text.strip():
        logger.warning("Gemini returned empty response text; failing closed to uncertain.")
        return ValidationResult(
            status=ValidationStatus.UNCERTAIN,
            reason="Validation provider returned an empty response.",
        )

    try:
        parsed = GeminiFundusResponse.model_validate_json(raw_text)
        return ValidationResult(
            status=parsed.status,
            reason=parsed.reason,
        )
    except Exception as exc:
        logger.warning(
            f"Failed to parse Gemini structured response '{raw_text}': {exc}; failing closed to uncertain."
        )
        return ValidationResult(
            status=ValidationStatus.UNCERTAIN,
            reason="Validation provider response could not be safely validated.",
        )
