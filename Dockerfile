# Production Dockerfile for Diabetic Retinopathy Inference Service
FROM python:3.12-slim

# Prevent Python from writing .pyc files and buffer outputs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860 \
    RETINA_MODEL_PATH=/app/retfound_model.keras

WORKDIR /app

# Install system dependencies (curl for healthchecks, OpenMP for numerical acceleration)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy model and application source
COPY retfound_model.keras .
COPY app.py .
COPY gunicorn.conf.py .

# Non-root user execution for container hardening
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 7860

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:7860/api/health || exit 1

# Production WSGI server
CMD ["gunicorn", "--config", "gunicorn.conf.py", "app:create_app()"]
