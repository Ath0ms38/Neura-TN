FROM python:3.12-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency files first for layer caching
COPY pyproject.toml uv.lock ./

# Install dependencies with uv (PyTorch CPU)
RUN uv sync --frozen --no-dev

# Copy application code
COPY train.py app.py chess_engine.py entrypoint.sh ./
COPY static/ static/

# Create models and data directories
RUN mkdir -p models data && \
    chmod +x entrypoint.sh

EXPOSE 5000

# Use entrypoint script to train models if needed and start the app
ENTRYPOINT ["./entrypoint.sh"]
