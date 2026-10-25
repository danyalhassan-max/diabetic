import os

# Server socket
port = os.environ.get("PORT", "7860")
bind = f"0.0.0.0:{port}"

# Worker processes
# Each TensorFlow CPU worker allocates ~800MB RAM.
# 2 workers x 2 threads is optimized for 2GB-4GB cloud containers.
workers = int(os.environ.get("GUNICORN_WORKERS", "2"))
threads = int(os.environ.get("GUNICORN_THREADS", "2"))
worker_class = "gthread"

# Timeouts
timeout = 120
graceful_timeout = 30
keepalive = 5

# Logging
loglevel = os.environ.get("LOG_LEVEL", "info")
accesslog = "-"
errorlog = "-"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(L)ss'

# Process management
preload_app = False  # Avoid TensorFlow fork safety issues by loading model per worker
