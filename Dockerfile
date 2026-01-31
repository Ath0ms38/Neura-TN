FROM python:3.12-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy dependency files first for layer caching
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen --no-dev

# Copy application code
COPY train.py app.py ./
COPY static/ static/

# Train models at build time
RUN uv run python train.py

EXPOSE 5000

CMD ["uv", "run", "python", "app.py"]
